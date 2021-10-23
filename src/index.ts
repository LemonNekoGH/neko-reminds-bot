import express from 'express'
import { Telegraf } from 'telegraf'
import packageJson from '../package.json'

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

/**
 * 取得 api token
 * @throws Error 获取不到时无法继续，报错
 */
function getToken (): string {
  // 从参数获取
  const tokenArg = process.argv.find((it) => it.startsWith('--token='))
  let token: string | undefined = ''
  if (tokenArg) {
    token = tokenArg.split('=')[1]
  }
  if (token) {
    return token
  }
  // 失败，从环境变量获取
  token = process.env.TG_DRINK_BOT_API
  if (!token) {
    throw new Error('telegram bot api token not found.')
  }
  return token
}

/**
 * 获取 webhook 地址
 * @throws Error 获取不到时报错，无法继续
 */
function getWebhookUrl (): string {
  const arg = process.argv.find((it) => it.startsWith('--webhook='))
  let url: string = ''
  if (arg) {
    url = arg.split('=')[1]
  }
  if (!url) {
    throw new Error('telegram webhook url not found.')
  }
  return url
}

async function main () {
  const token = getToken()
  const webhookBaseUrl = getWebhookUrl()

  const bot = new Telegraf(token)

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
    ctx.reply('还没有准备好设置向导')
  })

  bot.command('edit', (ctx) => {
    console.log('received command /edit')
    ctx.reply('还不能修改提醒项')
  })

  bot.command('import', (ctx) => {
    console.log('received command /import')
    ctx.reply('还不能导入配置')
  })
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
}

main().then()
