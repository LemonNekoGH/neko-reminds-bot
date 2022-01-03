import { Logger } from 'log4js'
import { Context, Markup, Telegraf } from 'telegraf'
import { DrinkBotConfig } from '../config'
import { NotifyTaskManager } from './NotifyTaskManager'
import { SettingProgress } from './SettingProgress'
import packageJson from '../package.json'
import express from 'express'
import { EditProgress } from './EditProgress'
import { DataStore } from './DataStore'
import { getNextRunTime } from './utils'

// 喝水 Bot 实例
export class DrinkBot {
    bot: Telegraf
    config: DrinkBotConfig
    logger: Logger
    taskManager: NotifyTaskManager
    settingProgressChatIdMap: Map<number, SettingProgress>
    editProgressChatIdMap: Map<number, EditProgress>

    constructor (config: DrinkBotConfig, logger: Logger) {
      this.config = config
      this.logger = logger
      this.bot = new Telegraf(this.config.token, {
        telegram: {
          agent: this.config.httpsProxyAgent
        }
      })
      // 初始化设置过程，修改过程集合
      this.settingProgressChatIdMap = new Map()
      this.editProgressChatIdMap = new Map()

      this.taskManager = new NotifyTaskManager(this.bot, this.logger)
      this.initBot()
    }

    // 初始化 bot 相关设置
    initBot: () => void = () => {
      const { bot, settingProgressChatIdMap: progressChatIdMap, logger, taskManager } = this
      const { storeFile, notifyChatId } = this.config

      // 初始化 bot 指令
      bot.command('info', (ctx) => {
        logger.info('收到 info 指令')
        ctx.replyWithMarkdown(`我是柠喵的提醒喝水小助手，不止提醒喝水哦。\n目前状态不稳定，可能会出现丢失配置、没有回复的情况。\n[GitHub](https://github.com/LemonNekoGH/neko-time-to-drink-bot)\n版本号 \`${packageJson.version}\``)
      })

      bot.command('help', (ctx) => {
        logger.info('收到 help 指令')
        ctx.reply('下面是柠喵要开发的命令: \n/start 开始为你或这个群组设置提醒项（已经可用）\n/import 导入提醒项\n/edit 修改提醒项\n/info 显示相关信息（已经可用）\n/help 显示此信息（已经可用）')
      })

      bot.command('start', async (ctx) => {
        logger.info('收到 start 指令')
        progressChatIdMap.set(ctx.chat.id, new SettingProgress(ctx.chat.id, this.config, this.bot, logger))
        const inlineBtns = Markup.inlineKeyboard([[Markup.button.callback('取消设置', 'cancel_setting')]])
        ctx.reply('开始设置，请为你的提醒项起一个名称', inlineBtns)
      })

      bot.command('edit', (ctx) => {
        logger.info('收到 edit 指令')
        // 获取提醒项列表
        const dataStore = new DataStore(this.config, this.logger)
        const remindsList = dataStore.getRemindsListForChat(ctx.chat.id)
        if (!remindsList.length) {
          logger.info('没有为这个对话设置提醒项 chatId' + ctx.chat.id)
          ctx.reply('没有为这个对话设置提醒项')
          return
        }
        // 发送提醒项列表
        const replyKeyboard: ReturnType<typeof Markup.button.callback>[][] = []
        remindsList.forEach(it => {
          replyKeyboard.push([Markup.button.callback(it, `edit.select.${it}`)])
        })
        this.bot.telegram.sendMessage(ctx.chat.id, '选择一个要修改的提醒项: ', Markup.inlineKeyboard(replyKeyboard))
      })

      bot.command('import', (ctx) => {
        logger.info('收到 import 指令')
        ctx.reply('还不能导入配置')
      })

      // 取消设置过程
      bot.action('cancel_setting', (ctx) => {
        if (!ctx.chat) {
          return
        }
        const { id } = ctx.chat
        const progress = progressChatIdMap.get(id)
        if (progress) {
          progressChatIdMap.delete(id)
          ctx.reply('已经取消设置过程')
        } else {
          ctx.reply('请不要点击最后一条信息之前的按钮')
        }
        ctx.answerCbQuery()
      })

      // 返回上一步设置
      bot.action('prev_step_setting', (ctx) => {
        if (!ctx.chat) {
          return
        }
        const { id } = ctx.chat
        const progress = progressChatIdMap.get(id)
        if (progress) {
          progress.prevStep()
        } else {
          ctx.reply('请不要点击最后一条信息之前的按钮')
        }
        ctx.answerCbQuery()
      })

      // 保存设置
      bot.action('save_setting', (ctx) => {
        if (!ctx.chat) {
          return
        }
        const { id } = ctx.chat
        const progress = progressChatIdMap.get(id)
        if (progress) {
          const success = progress.save()
          if (typeof success === 'boolean' && success) {
            // 保存成功，告诉当前用户
            ctx.reply('成功的保存了刚刚设置的提醒项')
            progressChatIdMap.delete(ctx.chat.id)
            // 然后更新任务管理器
            taskManager.initOrUpdateTasks(storeFile)
          } else if (typeof success === 'string') {
            // 保存时出错
            // 如果配置了提醒 ID，就发送错误提示
            if (notifyChatId) {
              bot.telegram.sendMessage(notifyChatId, `为 ChatID [${ctx.chat.id}] 保存提醒项时出错：${success}`)
            }
            // 告诉用户失败了
            ctx.reply('保存提醒项失败，可能是发生了什么错误，这个问题已经同时反馈给了柠喵')
          }
        } else {
          ctx.reply('请不要点击最后一条信息之前的按钮')
        }
        ctx.answerCbQuery()
      })

      // 重新展示提醒项列表
      bot.action('edit.back', (ctx) => {
        // 确保当前对话是有效的
        if (!ctx.chat) {
          return
        }
        // 获取提醒项列表
        const dataStore = new DataStore(this.config, this.logger)
        const remindsList = dataStore.getRemindsListForChat(ctx.chat.id)
        if (!remindsList.length) {
          logger.info('没有为这个对话设置提醒项 chatId' + ctx.chat.id)
          ctx.reply('没有为这个对话设置提醒项')
          return
        }
        // 发送提醒项列表
        const replyKeyboard: ReturnType<typeof Markup.button.callback>[][] = []
        remindsList.forEach(it => {
          replyKeyboard.push([Markup.button.callback(it, `edit.select.${it}`)])
        })
        this.bot.telegram.sendMessage(ctx.chat.id, '选择一个要修改的提醒项: ', Markup.inlineKeyboard(replyKeyboard)).then(() => {
          // 确保当前对话仍然是有效的
          if (!ctx.chat) {
            return
          }
          // 发送成功后更新修改过程
          let editProgress = this.editProgressChatIdMap.get(ctx.chat.id)
          if (!editProgress) {
            // 不在修改过程中，新建修改过程
            editProgress = new EditProgress(this.bot, this.logger, this.config, ctx.chat.id)
          }
          editProgress.remindName = ''
          editProgress.waitFor = 'selectRemind'
          this.editProgressChatIdMap.set(ctx.chat.id, editProgress)
        })
      })

      // 选择要修改的提醒项
      bot.action(/edit\.select\..*$/, (ctx) => {
        // 确保当前对话是有效的
        if (!ctx.chat) {
          return
        }
        // 获取到要修改的提醒项名称
        let name: string = (ctx.callbackQuery as any).data
        name = name.substring('edit.select.'.length)
        this.logger.debug(`收到要修改的提醒项 chatId: ${ctx.chat.id} name: ${name}`)
        // 尝试获取提醒项
        const dataStore = new DataStore(this.config, this.logger)
        const remind = dataStore.getRemindItem(ctx.chat.id, name)
        if (!remind) {
          // 提醒项不存在
          ctx.reply(`提醒项 [${name}] 已经不存在了`)
          ctx.answerCbQuery()
          return
        }
        // 发送提醒项具体信息，和操作按钮
        const message = `当前提醒项: ${name}\n\n提醒周期 cron 表达式: ${remind.cron}\n提醒内容: ${remind.text}\n下次提醒时间: ${getNextRunTime(remind.cron)}\n你可以进行以下操作: `
        const markupBtns = [
          [Markup.button.callback('修改提醒周期', `edit.cron.${name}`)],
          [Markup.button.callback('修改提醒内容', `edit.content.${name}`)],
          [Markup.button.callback('« 返回提醒项列表', 'edit.back')]
        ]
        // 回复消息
        ctx.reply(message, Markup.inlineKeyboard(markupBtns)).then(() => {
          // 确保当前对话仍然是有效的
          if (!ctx.chat) {
            return
          }
          // 发送成功后更新修改过程
          let editProgress = this.editProgressChatIdMap.get(ctx.chat.id)
          if (!editProgress) {
          // 不在修改过程中，新建修改过程
            editProgress = new EditProgress(this.bot, this.logger, this.config, ctx.chat.id)
          }
          editProgress.remindName = name
          editProgress.waitFor = 'selectAction'
          this.editProgressChatIdMap.set(ctx.chat.id, editProgress)
        })
      })

      // 确定要修改周期
      bot.action(/edit\.cron\..*$/, (ctx) => {
        // 确保当前对话是有效的
        if (!ctx.chat) {
          return
        }
        // 获取到要修改的提醒项名称
        let name: string = (ctx.callbackQuery as any).data
        name = name.substring('edit.cron.'.length)
        this.logger.debug(`收到要修改的提醒项 chatId: ${ctx.chat.id} name: ${name}`)
        // 尝试获取提醒项
        const dataStore = new DataStore(this.config, this.logger)
        const remind = dataStore.getRemindItem(ctx.chat.id, name)
        if (!remind) {
          // 提醒项不存在
          ctx.reply(`提醒项 [${name}] 已经不存在了`)
          ctx.answerCbQuery()
          return
        }
        // 告诉用户回复一个新的提醒周期
        ctx.reply(`当前提醒项: ${name}\n\n提醒周期 cron 表达式: ${remind.cron}\n提醒内容: ${remind.text}\n下次提醒时间: ${getNextRunTime(remind.cron)}\n请回复新的提醒周期`).then(() => {
          // 确保当前对话仍然是有效的
          if (!ctx.chat) {
            return
          }
          // 发送成功后更新修改过程
          let editProgress = this.editProgressChatIdMap.get(ctx.chat.id)
          if (!editProgress) {
            // 不在修改过程中，新建修改过程
            editProgress = new EditProgress(this.bot, this.logger, this.config, ctx.chat.id)
          }
          editProgress.remindName = name
          editProgress.waitFor = 'cycle'
          this.editProgressChatIdMap.set(ctx.chat.id, editProgress)
        })
      })

      // 确定要修改内容
      bot.action(/edit\.content\..*$/, (ctx) => {
        // 确保当前对话是有效的
        if (!ctx.chat) {
          return
        }
        // 获取到要修改的提醒项名称
        let name: string = (ctx.callbackQuery as any).data
        name = name.substring('edit.content.'.length)
        this.logger.debug(`收到要修改的提醒项 chatId: ${ctx.chat.id} name: ${name}`)
        // 尝试获取提醒项
        const dataStore = new DataStore(this.config, this.logger)
        const remind = dataStore.getRemindItem(ctx.chat.id, name)
        if (!remind) {
          // 提醒项不存在
          ctx.reply(`提醒项 [${name}] 已经不存在了`)
          ctx.answerCbQuery()
          return
        }
        // 告诉用户回复一个新的提醒周期
        ctx.reply(`当前提醒项: ${name}\n\n提醒周期 cron 表达式: ${remind.cron}\n提醒内容: ${remind.text}\n下次提醒时间: ${getNextRunTime(remind.cron)}\n请回复新的提醒内容`).then(() => {
          // 确保当前对话仍然是有效的
          if (!ctx.chat) {
            return
          }
          // 发送成功后更新修改过程
          let editProgress = this.editProgressChatIdMap.get(ctx.chat.id)
          if (!editProgress) {
            // 不在修改过程中，新建修改过程
            editProgress = new EditProgress(this.bot, this.logger, this.config, ctx.chat.id)
          }
          editProgress.remindName = name
          editProgress.waitFor = 'content'
          this.editProgressChatIdMap.set(ctx.chat.id, editProgress)
        })
      })

      // 收到贴纸时
      bot.on('sticker', (ctx) => {
        this.logger.info(`收到一张贴纸 chatid: ${ctx.chat.id} file_id: ${ctx.message.sticker.file_id}`)
        ctx.replyWithSticker('CAACAgUAAxkBAAMOYcFsMtq39HunVGzbeL5zPR7xidkAAssEAAK_K_hXVdVhDHMJpAkjBA')
      })

      // 收到普通消息时
      bot.on('text', (ctx) => {
        const { text } = ctx.message
        const { id } = ctx.chat
        const progress = progressChatIdMap.get(id)
        const editProgress = this.editProgressChatIdMap.get(id)

        if (progress) {
          // 在设置过程
          progress.nextStep(text)
        } else if (editProgress) {
          // 在编辑过程
          editProgress.receivedText(text)
        } else {
          // 不在，复读
          ctx.reply('略略略', Markup.removeKeyboard())
        }
      })
    }

    requireActionInEditProgress: (ctx: Context, fn: (ctx: Context, progress: EditProgress) => void) => void = (ctx, fn) => {
      if (!ctx.chat) {
        return
      }
      const { id } = ctx.chat
      const progress = this.editProgressChatIdMap.get(id)
      if (progress) {
        // 在修改过程中
        fn(ctx, progress)
      } else {
        // 不在修改过程中
        ctx.reply('没有在修改过程中')
      }
      ctx.answerCbQuery()
    }

    // 启动 bot
    run: () => void = async () => {
      const { webhookUrl: webhookBaseUrl, notifyChatId } = this.config
      const { bot, logger } = this
      if (webhookBaseUrl) {
        // 设置 webhook
        const secretPath = `/telegraf/${bot.secretPathComponent()}`
        await bot.telegram.setWebhook(`${webhookBaseUrl}${secretPath}`)
        // 启动 express
        const app = express()
        app.get('/', (req, resp) => resp.send('柠喵的喝水小助手'))
        app.use(bot.webhookCallback(secretPath))
        app.listen(5500, () => {
          console.log('Express with telegraf webhook is listening at port 5500')
        })
      } else {
        bot.launch().then(() => {
          // 启动成功后，初始化提醒任务并发送给用户
          this.taskManager.initOrUpdateTasks(this.config.storeFile)
          this.taskManager.sendRebootMessage()
          if (notifyChatId) {
            bot.telegram.sendMessage(notifyChatId, '柠喵的喝水提醒小助手已成功启动')
          }
          logger.info('Bot 启动好了')
        }).catch((e) => {
          console.error(e.message)
        })
      }
    }
}
