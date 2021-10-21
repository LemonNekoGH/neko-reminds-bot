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

function main () {
  const token = process.env.TG_DRINK_BOT_API
  if (!token) {
    console.error('telegram bot api token not found.')
    return
  }
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

  bot.launch()

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

main()
