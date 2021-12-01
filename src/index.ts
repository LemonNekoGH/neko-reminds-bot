import express from 'express'
import { Telegraf } from 'telegraf'
import packageJson from '../package.json'
import fs from 'fs'
import { DrinkBotConfig } from '../config/type'
import axios from 'axios'
import log4js, { Logger } from 'log4js'
import { SettingProgress } from './SettingProgress'

export interface RemindItem {
    text: string
    cron: string
}

// 所有提醒项
export interface Reminds {
  // ChatID
  [p: number]: {
    // 名字对应提醒项
    [p: string]: RemindItem
  }
}

// 通用的用于寻找参数的方法
function getSpecifiedArg (prefix: string, onFound: ((arg: string) => Error | undefined) | null, errorText: string): string {
  const arg = process.argv.find((it) => it.startsWith(prefix))
  let ret = ''
  if (arg) {
    ret = arg.substr(prefix.length)
  }
  if (!ret && errorText) {
    throw new Error(errorText)
  }
  if (onFound) {
    const error = onFound(ret)
    if (error) {
      throw error
    }
  }
  return ret
}

const progressChatIdMap = new Map<number, SettingProgress>()

// 验证配置文件的正确性
async function verifyConfig (config: DrinkBotConfig, logger: Logger):Promise<boolean> {
  logger.debug('开始校验配置文件正确性')
  const { token, storeFile, httpsProxyAgent } = config as DrinkBotConfig
  // 测试代理
  if (httpsProxyAgent) {
    try {
      const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { httpsAgent: httpsProxyAgent })
      if (!res.data || !res.data.ok) {
        logger.error('代理测试成功，但是返回错误')
      }
      logger.debug('代理测试成功')
    } catch (e) {
      let msg = ''
      if (e instanceof Error) {
        msg = e.message
      }
      if (msg === '') {
        logger.warn('没有正确获取到错误类型')
      }
      logger.error('代理测试失败：' + msg)
      return false
    }
  }
  // 测试数据文件
  try {
    // 尝试读取
    const content = fs.readFileSync(storeFile).toString()
    JSON.parse(content) as Reminds
    logger.debug('数据存储文件配置正确')
  } catch (e) {
    let msg = ''
    if (e instanceof Error) {
      msg = e.message
    }
    if (msg === '') {
      logger.warn('没有正确获取到错误类型')
    }
    logger.error('数据存储文件配置不正确：' + msg)
    return false
  }
  logger.debug('配置文件校验成功')
  return true
}

async function main () {
  // 获取配置文件
  let config: DrinkBotConfig | null = null
  const logger = log4js.getLogger()
  logger.level = log4js.levels.ALL.levelStr

  try {
    const { config: c } = await import('../config/config')
    config = c
    logger.debug('配置文件获取成功')
  } catch (e) {
    logger.error('配置文件获取失败，请根据 config 文件夹中的 config.ts.example 创建 config.ts')
    return
  }
  // 检查配置文件的正确性
  if (!await verifyConfig(config, logger)) {
    return
  }
  const { token, storeFile, webhookUrl: webhookBaseUrl, httpsProxyAgent, notifyChatId } = config as DrinkBotConfig

  const bot = new Telegraf(token, {
    telegram: {
      agent: httpsProxyAgent
    }
  })

  bot.command('info', (ctx) => {
    console.log('received command /info')
    ctx.replyWithMarkdown(`我是柠喵的提醒喝水小助手，不止提醒喝水哦。\n目前状态不稳定，可能会出现丢失配置、没有回复的情况。\n[GitHub](https://github.com/LemonNekoGH/neko-time-to-drink-bot)\n版本号 \`${packageJson.version}\``)
  })

  bot.command('help', (ctx) => {
    console.log('received command /help')
    ctx.reply('下面是柠喵要开发的命令：\n/start 开始为你或这个群组设置提醒项（已经可用）\n/import 导入提醒项\n/edit 修改提醒项\n/info 显示相关信息（已经可用）\n/help 显示此信息（已经可用）')
  })

  bot.command('start', (ctx) => {
    console.log('received command /start')
    progressChatIdMap.set(ctx.chat.id, new SettingProgress(ctx.chat.id, storeFile, logger))
    ctx.reply('开始设置，请为你的提醒项起一个名称，或回复“取消”停止设置')
  })

  bot.command('edit', (ctx) => {
    console.log('received command /edit')
    ctx.reply('还不能修改提醒项')
  })

  bot.command('import', (ctx) => {
    console.log('received command /import')
    ctx.reply('还不能导入配置')
  })

  bot.on('text', (ctx) => {
    const { text } = ctx.message
    const { id } = ctx.chat
    const progress = progressChatIdMap.get(id)

    switch (text) {
      case '取消':
        if (progress) {
          progressChatIdMap.delete(id)
          ctx.reply('已经取消设置过程')
        } else {
          ctx.reply('没有在设置过程中，回复“取消”是无效的')
        }
        break
      case '上一步':
        if (progress) {
          progress.prevStep(ctx)
        } else {
          ctx.reply('没有在设置过程中，回复“上一步”是无效的')
        }
        break
      case '保存':
        if (progress) {
          const success = progress.save()
          if (typeof success === 'boolean' && success) {
            ctx.reply('成功的保存了你的提醒项')
            progressChatIdMap.delete(ctx.chat.id)
          } else if (typeof success === 'string') {
            // 保存时出错
            // 如果配置了提醒 ID，就发送错误提示
            if (notifyChatId) {
              bot.telegram.sendMessage(notifyChatId, `为 ChatID [${ctx.chat.id}] 保存提醒项时出错：${success}`)
            }
            // 告诉用户失败了
            ctx.reply('保存提醒项失败，可能是发生了什么错误\n回复“上一步”重新设置提醒周期\n回复“取消”停止设置')
          }
        } else {
          ctx.reply('没有在设置过程中，回复“保存”是无效的')
        }
        break
      default:
        if (progress) {
          // 不是特定的指令，判断是否正在设置过程
          progress.nextStep(text, ctx)
        } else {
          // 不在，复读
          ctx.reply('我是一个没有感情的提醒机器人，没事不要和我说话，说话我也只会回复这么一句。')
        }
        break
    }
  })

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

main().then()
