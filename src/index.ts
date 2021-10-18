import { Telegraf } from 'telegraf'
import packageJson from '../package.json'

function main () {
  const token = process.env.TG_DRINK_BOT_API
  if (!token) {
    console.error('telegram bot api token not found.')
    return
  }
  const bot = new Telegraf(token)

  bot.command('info', (ctx) => {
    console.log('received command \'info\'')
    ctx.replyWithMarkdown(`我是柠喵的提醒喝水小助手，不止提醒喝水哦。\n目前只会复读你的消息。\n版本号 \`${packageJson.version}\``)
  })

  bot.on('text', (ctx) => {
    if (!ctx.message.text.includes('no_repeat')) {
      ctx.reply(ctx.message.text)
    }
  })

  bot.launch()

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

main()
