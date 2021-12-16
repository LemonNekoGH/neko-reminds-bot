import { Markup, Telegraf } from 'telegraf'
import { RemindItem } from '.'
import { readFromStoreFile } from './utils'
import { Logger } from 'log4js'
import { DrinkBotConfig } from '../config'

// 修改提醒项
export class EditProgress {
  bot: Telegraf // bot 实例
  name: string = '' // 提醒项现在的名称
  prevName: string = '' // 提醒项名称修改之前
  remindItem: RemindItem | null = null // 提醒项
  nowStep: 0 | 1 | 2 | 3 | 4 = 0 // 正在进行的步骤, 0 - 选择要修改的提醒项, 1 - 选择要修改的内容, 2 - 名称, 3 - cron, 4 - 内容
  chatId: number // 正在请求修改的对话 id
  logger: Logger
  config: DrinkBotConfig

  constructor (bot: Telegraf, logger: Logger, config: DrinkBotConfig, chatId: number) {
    this.bot = bot
    this.logger = logger
    this.config = config
    this.chatId = chatId
  }

  // 显示所有可以修改的项
  showAllItemName: () => boolean = () => {
    const reminds = readFromStoreFile(this.config.storeFile)
    if (reminds instanceof Error) {
      this.logger.error('读取存储文件时出错: ' + reminds.message)
      this.bot.telegram.sendMessage(this.chatId, '读取可编辑提醒项列表时出错了，这个问题已经同时进行了反馈')
      const notifyId = this.config.notifyChatId
      if (notifyId) {
        this.bot.telegram.sendMessage(notifyId, `在为 [${this.chatId}] 显示可编辑提醒项列表时出错了: ${reminds.message}`)
      }
      return false
    }
    const remindsForChat = reminds[this.chatId]
    if (!remindsForChat) {
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      // 没有提醒项
      return false
    }
    const keys = Object.keys(remindsForChat)
    if (keys.length === 0) {
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      // 也没有提醒项
      return false
    }
    const replyKeyboard: ReturnType<typeof Markup.button.text>[][] = []
    keys.forEach(it => {
      replyKeyboard.push([Markup.button.text(it)])
    })
    replyKeyboard.push([Markup.button.text('取消')])
    this.bot.telegram.sendMessage(this.chatId, '请回复要修改的提醒项名称', Markup.keyboard(replyKeyboard).resize())
    return true
  }

  // 收到信息之后
  receivedText: (text: string) => void = (text) => {
    switch (this.nowStep) {
      case 0:
        this.stepSelectItemByName(text)
        break
    }
  }

  // 选择提醒项步骤
  stepSelectItemByName: (text: string) => Promise<void> = async (text) => {
    this.logger.debug('开始验证提醒项名称是否存在')
    const reminds = readFromStoreFile(this.config.storeFile)
    if (reminds instanceof Error) {
      this.logger.error('读取存储文件时出错: ' + reminds.message)
      this.bot.telegram.sendMessage(this.chatId, '在检查收到的提醒项名称是否存在时出错，这个问题已经同时进行了反馈')
      const notifyId = this.config.notifyChatId
      if (notifyId) {
        this.bot.telegram.sendMessage(notifyId, `在为 [${this.chatId}] 显示可编辑提醒项列表时出错了: ${reminds.message}`)
      }
      return
    }
    const remindsForChat = reminds[this.chatId]
    if (!remindsForChat) {
      // 没有提醒项
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      this.bot.telegram.sendMessage(this.chatId, '没有这个名字的提醒项')
      return
    }
    const keys = Object.keys(reminds)
    if (keys.length === 0) {
      // 也没有提醒项
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      this.bot.telegram.sendMessage(this.chatId, '没有这个名字的提醒项')
      return
    }
    const remind = remindsForChat[text]
    if (!remind) {
      // 提醒项不存在
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      this.bot.telegram.sendMessage(this.chatId, '没有这个名字的提醒项')
      return
    }
    // 提醒项存在，开始编辑
    this.name = text
    this.prevName = text
    this.remindItem = remind
    this.nowStep = 1
    await this.bot.telegram.sendMessage(this.chatId, '开始修改', Markup.removeKeyboard())
    this.bot.telegram.sendMessage(this.chatId, '请选择要修改的内容', Markup.inlineKeyboard([
      [Markup.button.callback('名称', 'name_edit'), Markup.button.callback('提醒内容', 'text_edit')],
      [Markup.button.callback('提醒周期', 'cron_edit')]
    ]))
  }
}
