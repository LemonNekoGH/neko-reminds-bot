import express from 'express'
import { Telegraf } from 'telegraf'
import packageJson from '../package.json'
import fs from 'fs'
import { DrinkBotConfig } from '../config/type'

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
  step: 'naming' | 'text' | 'cron' = 'naming'
  chatId: number
  name: string = ''
  cron: string = ''

  constructor (chatId: number) {
    this.chatId = chatId
  }
}

const progressChatIdMap = new Map<number, SettingProgress>()

async function main () {
  // 获取配置文件
  let config: DrinkBotConfig | null = null
  try {
    const { config: c } = await import('../config/config')
    config = c
  } catch (e) {
    console.error(e)
    return
  }
  const { token, storeFile, webhookUrl: webhookBaseUrl, httpsProxyAgent, notifyChatId } = config as DrinkBotConfig

  const bot = new Telegraf(token, {
    telegram: {
      agent: httpsProxyAgent
    }
  })

  bot.on('text', (ctx) => {
    if (ctx.message.text === '取消') {
      if (progressChatIdMap.has(ctx.chat.id)) {
        progressChatIdMap.delete(ctx.chat.id)
        ctx.reply('已经取消设置过程')
      } else {
        ctx.reply('没有开始设置，取消个啥')
      }
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
      if (notifyChatId) {
        bot.telegram.sendMessage(notifyChatId, '柠喵的喝水提醒小助手已成功启动')
      }
      console.log('bot is now running')
    }).catch((e) => {
      console.error(e.message)
    })
  }
}

main().then()
