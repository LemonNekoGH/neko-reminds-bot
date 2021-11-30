import express from 'express'
import { Context, Telegraf } from 'telegraf'
import packageJson from '../package.json'
import fs from 'fs'
import { DrinkBotConfig } from '../config/type'
import axios from 'axios'
import log4js from 'log4js'
import cron from 'node-cron'
import cronParser from 'cron-parser'

interface RemindItem {
    text: string
    cron: string
}

// 所有提醒项
interface Reminds {
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

class SettingProgress {
  step: number = 0
  chatId: number
  text: string = ''
  name: string = ''
  cron: string = ''
  stepName: string[] = [
    '提醒项名称',
    '提醒项内容',
    '提醒周期'
  ]

  replyText: string[] = [
    '请设置提醒项的名称',
    '请设置要提醒的内容',
    '请设置提醒周期：一个 [cron 表达式](https://zh.wikipedia.org/wiki/Cron)'
  ]

  constructor (chatId: number) {
    this.chatId = chatId
  }

  // 设置提醒名步骤
  setNameStep (text: string, ctx: Context): void {
    this.name = text
    ctx.reply(`提醒项的名称已被设定为 ${text}\n${this.replyText[this.step + 1]}\n回复“上一步”重新设置${this.stepName[this.step]}\n回复“取消”停止设置`)
    this.step++
  }

  // 设置提醒内容步骤
  setTextStep (text: string, ctx: Context): void {
    this.text = text
    ctx.replyWithMarkdown(`提醒项的内容已被设定为 ${text}\n${this.replyText[this.step + 1]}\n回复“上一步”重新设置${this.stepName[this.step]}\n回复“取消”停止设置`)
    this.step++
  }

  // 设置提醒周期步骤
  setCornStep (text: string, ctx: Context): void {
    const result = cron.validate(text)
    if (result) {
      const nextRun = cronParser.parseExpression(text).next().toISOString()
      ctx.reply(`提醒项的提醒周期已被设定为 ${text}\n下次提醒时间在 ${nextRun}\n回复“保存”保存设置\n回复“上一步”重新设置${this.stepName[this.step]}\n回复“取消”停止设置`)
    } else {
      ctx.reply(`cron 表达式解析错误，请重新设置\n回复“上一步”重新设置${this.stepName[this.step]}\n回复“取消”停止设置`)
    }
  }

  // 收到消息后处理
  nextStep (text: string, ctx: Context): void {
    switch (this.step) {
      case 0: this.setNameStep(text, ctx); break
      case 1: this.setTextStep(text, ctx); break
      case 2: this.setCornStep(text, ctx); break
    }
  }

  // 返回上一步设置
  prevStep (ctx: Context): void {
    if (this.step === 0) {
      ctx.reply('已经是第一步了')
      return
    }
    this.step--
    let replyText = '返回到了上一步\n'
    replyText += this.replyText[this.step] + '\n'
    if (this.step !== 0) {
      replyText += `回复“上一步”重新设置${this.stepName[this.step - 1]}\n`
    }
    replyText += '回复“取消”停止设置'
    ctx.reply(replyText)
  }
}

const progressChatIdMap = new Map<number, SettingProgress>()

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
    console.error(e)
    return
  }
  const { token, storeFile, webhookUrl: webhookBaseUrl, httpsProxyAgent, notifyChatId } = config as DrinkBotConfig

  // 测试代理
  if (httpsProxyAgent) {
    try {
      const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { httpsAgent: httpsProxyAgent })
      if (!res.data || !res.data.ok) {
        logger.error('代理测试成功，但是返回错误')
      }
      logger.debug('代理测试成功')
    } catch (e) {
      logger.error(e)
      return
    }
  }

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
    ctx.reply('下面是可以使用的命令：\n/start 开始为你或这个群组设置提醒项\n/import 导入提醒项\n/edit 修改提醒项\n/info 显示相关信息\n/help 显示此信息')
  })

  bot.command('start', (ctx) => {
    console.log('received command /start')
    progressChatIdMap.set(ctx.chat.id, new SettingProgress(ctx.chat.id))
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
          ctx.reply(text)
        }
        break
      case '上一步':
        if (progress) {
          progress.prevStep(ctx)
        } else {
          ctx.reply(text)
        }
        break
      default:
        if (progress) {
          // 不是特定的指令，判断是否正在设置过程
          progress.nextStep(text, ctx)
        } else {
          // 不在，复读
          ctx.reply(text)
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
