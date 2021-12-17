import { Logger } from 'log4js'
import { Context, Markup, Telegraf } from 'telegraf'
import { DrinkBotConfig } from '../config'
import { NotifyTaskManager } from './NotifyTaskManager'
import { SettingProgress } from './SettingProgress'
import packageJson from '../package.json'
import express from 'express'
import { EditProgress } from './EditProgress'

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
      this.taskManager.initOrUpdateTasks(this.config.storeFile)

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
        progressChatIdMap.set(ctx.chat.id, new SettingProgress(ctx.chat.id, storeFile, logger))
        const inlineBtns = Markup.inlineKeyboard([[Markup.button.callback('取消设置', 'cancel_setting')]])
        ctx.reply('开始设置，请为你的提醒项起一个名称', inlineBtns)
      })

      bot.command('edit', (ctx) => {
        logger.info('收到 edit 指令')
        const progress = new EditProgress(bot, logger, this.config, ctx.chat.id)
        if (progress.showAllItemName()) {
          this.editProgressChatIdMap.set(ctx.chat.id, progress)
        } else {
          ctx.reply('没有找到为这个对话设置的提醒项')
        }
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
          progress.prevStep(ctx)
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

      // 修改提醒项名称
      bot.action('name_edit', (ctx) => {
        if (!ctx.chat) {
          return
        }
        const { id } = ctx.chat
        const progress = this.editProgressChatIdMap.get(id)
        if (progress) {
          // 在修改过程中
          progress.nowStep = 2
          ctx.reply('请回复新的名称', Markup.inlineKeyboard([[Markup.button.callback('返回', 'reselect_content_edit')], [Markup.button.callback('取消', 'cancel_edit')]]))
        } else {
          // 不在修改过程中
          ctx.reply('没有在修改过程中')
        }
        ctx.answerCbQuery()
      })

      // 修改提醒项内容
      bot.action('text_edit', (ctx) => {
        if (!ctx.chat) {
          return
        }
        const { id } = ctx.chat
        const progress = this.editProgressChatIdMap.get(id)
        if (progress) {
          // 在修改过程中
          progress.nowStep = 4
          ctx.reply('请回复新的内容', Markup.inlineKeyboard([[Markup.button.callback('返回', 'reselect_content_edit')], [Markup.button.callback('取消', 'cancel_edit')]]))
        } else {
          // 不在修改过程中
          ctx.reply('没有在修改过程中')
        }
        ctx.answerCbQuery()
      })

      // 修改提醒项周期
      bot.action('cron_edit', (ctx) => {
        if (!ctx.chat) {
          return
        }
        const { id } = ctx.chat
        const progress = this.editProgressChatIdMap.get(id)
        if (progress) {
          // 在修改过程中
          progress.nowStep = 3
          ctx.reply('请回复新的提醒周期', Markup.inlineKeyboard([[Markup.button.callback('返回', 'reselect_content_edit')], [Markup.button.callback('取消', 'cancel_edit')]]))
        } else {
          // 不在修改过程中
          ctx.reply('没有在修改过程中')
        }
        ctx.answerCbQuery()
      })

      // 返回到选择要修改的字段
      bot.action('reselect_content_edit', (ctx) => {
        if (!ctx.chat) {
          return
        }
        const { id } = ctx.chat
        const progress = this.editProgressChatIdMap.get(id)
        if (progress) {
          // 在修改过程中
          progress.nowStep = 1
          const { prevName, name, remindItem, newRemindItem } = progress
          if (!remindItem || !newRemindItem) {
            this.logger.debug('可能还没有选择要修改的提醒项')
          } else {
            this.logger.debug(`返回到选择要修改的字段 chatid: ${id}`)
            const btnLine2: ReturnType<typeof Markup.button.callback>[] = []
            if (name !== prevName || remindItem.cron !== newRemindItem.cron || remindItem.text !== newRemindItem.text) {
              // 有项目被修改了，加入保存按钮
              btnLine2.push(Markup.button.callback('保存修改', 'save_edit'))
            }
            btnLine2.push(Markup.button.callback('取消修改', 'cancel_edit'))
            ctx.reply('请选择要修改的字段', Markup.inlineKeyboard([
              [Markup.button.callback('名称', 'name_edit'), Markup.button.callback('提醒内容', 'text_edit'), Markup.button.callback('提醒周期', 'cron_edit')],
              btnLine2
            ]))
          }
        } else {
          // 不在修改过程中
          ctx.reply('没有在修改过程中')
        }
        ctx.answerCbQuery()
      })

      // 返回到选择要修改的提醒项
      bot.action('reselect_item_edit', (ctx) => {
        if (!ctx.chat) {
          return
        }
        const { id } = ctx.chat
        const progress = this.editProgressChatIdMap.get(id)
        if (progress) {
          // 在修改过程中
          progress.nowStep = 0
          if (!progress.showAllItemName()) {
            // 显示所有提醒项时发现提醒项无了
            ctx.reply('找不到为这个对话设置的提醒项，已取消修改')
            this.editProgressChatIdMap.delete(id)
          }
        } else {
          // 不在修改过程中
          ctx.reply('没有在修改过程中')
        }
        ctx.answerCbQuery()
      })

      // 取消修改过程
      bot.action('cancel_edit', (ctx) => {
        this.requireActionInEditProgress(ctx, (ctx, progress) => {
          this.editProgressChatIdMap.delete(ctx.chat!.id)
          ctx.reply('已取消修改过程')
        })
      })

      // 保存修改
      bot.action('save_edit', (ctx) => {
        this.requireActionInEditProgress(ctx, (ctx, progress) => {
          const success = progress.saveEdit()
          if (success) {
            ctx.reply('成功的保存了修改')
            this.editProgressChatIdMap.delete(ctx.chat!.id)
            taskManager.initOrUpdateTasks(this.config.storeFile)
          }
        })
      })

      // 收到普通消息时
      bot.on('text', (ctx) => {
        const { text } = ctx.message
        const { id } = ctx.chat
        const progress = progressChatIdMap.get(id)
        const editProgress = this.editProgressChatIdMap.get(id)

        if (progress) {
          // 在设置过程
          progress.nextStep(text, ctx)
        } else if (editProgress) {
          // 在编辑过程
          if (text === '取消') {
            this.logger.info('取消了编辑过程 chatid: ' + id)
            this.editProgressChatIdMap.delete(id)
            ctx.reply('取消了编辑过程', Markup.removeKeyboard())
          } else {
            editProgress.receivedText(text)
          }
        } else {
          // 不在，复读
          ctx.reply('我是一个没有感情的提醒机器人，没事不要和我说话，说话我也只会回复这么一句。', Markup.removeKeyboard())
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
          // 启动成功后，给要提醒的 chatid 发送消息提示
          if (notifyChatId) {
            bot.telegram.sendMessage(notifyChatId, '柠喵的喝水提醒小助手已成功启动')
          }
          logger.info('bot is now running')
        }).catch((e) => {
          console.error(e.message)
        })
      }
    }
}
