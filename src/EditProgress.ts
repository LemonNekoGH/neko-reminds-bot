import { Markup, Telegraf } from 'telegraf'
import { RemindItem } from '.'
import { readFromStoreFile, saveToStoreFile } from './utils'
import { Logger } from 'log4js'
import { DrinkBotConfig } from '../config'
import nodeCron from 'node-cron'
import cronParser from 'cron-parser'
import moment from 'moment'

// 修改提醒项
export class EditProgress {
  bot: Telegraf // bot 实例
  name: string = '' // 提醒项现在的名称
  prevName: string = '' // 提醒项名称修改之前
  remindItem: RemindItem | null = null // 提醒项
  newRemindItem: RemindItem | null = null // 新的提醒项
  nowStep: 0 | 1 | 2 | 3 | 4 = 0 // 正在进行的步骤, 0 - 选择要修改的提醒项, 1 - 选择要修改的内容, 2 - 名称, 3 - 周期, 4 - 内容
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
    // 重置已经修改的内容
    this.name = ''
    this.prevName = ''
    this.newRemindItem = null
    this.remindItem = null

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
      // 没有提醒项
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      return false
    }
    const keys = Object.keys(remindsForChat)
    if (keys.length === 0) {
      // 也没有提醒项
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      return false
    }
    const replyKeyboard: ReturnType<typeof Markup.button.text>[][] = []
    keys.forEach(it => {
      if (remindsForChat[it]) {
        replyKeyboard.push([Markup.button.text(it)])
      }
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
      case 2:
        this.stepEditName(text)
        break
      case 3:
        this.stepEditCron(text)
        break
      case 4:
        this.stepEditText(text)
        break
    }
  }

  // 修改名称步骤
  stepEditName: (text: string) => void = (text) => {
    if (!this.newRemindItem || !this.remindItem) {
      this.logger.debug('出现错误，可能还没有选择要修改的内容')
      return
    }

    if (text === this.prevName) {
      this.logger.debug('新的名称和初始名称一样')
      this.bot.telegram.sendMessage(this.chatId, '新的名字和初始名字一样，请输入另一个', Markup.inlineKeyboard([[Markup.button.callback('返回', 'reselect_content_edit')]]))
      return
    }
    this.name = text
    this.logger.debug(`获取到新的名称 chatId: ${this.chatId} name: ${this.prevName} -> ${this.name}`)
    const btnLine2: ReturnType<typeof Markup.button.callback>[] = []
    if (this.name !== this.prevName || this.remindItem?.cron !== this.newRemindItem?.cron || this.remindItem?.text !== this.newRemindItem?.text) {
      // 有项目被修改了，加入保存按钮
      btnLine2.push(Markup.button.callback('保存修改', 'save_edit'))
    }
    btnLine2.push(Markup.button.callback('取消修改', 'cancel_edit'))
    this.bot.telegram.sendMessage(this.chatId, `提醒项名称修改成了 ${this.name}\n请选择要修改的字段`, Markup.inlineKeyboard([
      [Markup.button.callback('名称', 'name_edit'), Markup.button.callback('提醒内容', 'text_edit'), Markup.button.callback('提醒周期', 'cron_edit')],
      btnLine2
    ]))
  }

  // 修改内容步骤
  stepEditText: (text: string) => void = (text) => {
    if (!this.newRemindItem || !this.remindItem) {
      this.logger.debug('出现错误，可能还没有选择要修改的内容')
      return
    }

    if (text === this.remindItem.text) {
      this.logger.debug('新的内容和初始内容一样')
      this.bot.telegram.sendMessage(this.chatId, '新的提醒内容和初始内容一样，请输入另一个', Markup.inlineKeyboard([[Markup.button.callback('返回', 'reselect_content_edit')]]))
      return
    }

    this.newRemindItem.text = text
    this.logger.debug(`获取到新的提醒内容 chatId: ${this.chatId} text: ${this.remindItem.text} -> ${this.newRemindItem.text}`)
    const btnLine2: ReturnType<typeof Markup.button.callback>[] = []
    if (this.name !== this.prevName || this.remindItem.cron !== this.newRemindItem.cron || this.remindItem.text !== this.newRemindItem.text) {
      // 有项目被修改了，加入保存按钮
      btnLine2.push(Markup.button.callback('保存修改', 'save_edit'))
    }
    btnLine2.push(Markup.button.callback('取消修改', 'cancel_edit'))
    this.bot.telegram.sendMessage(this.chatId, `提醒项内容修改成了 ${this.newRemindItem.text}\n请选择要修改的字段`, Markup.inlineKeyboard([
      [Markup.button.callback('名称', 'name_edit'), Markup.button.callback('提醒内容', 'text_edit'), Markup.button.callback('提醒周期', 'cron_edit')],
      btnLine2
    ]))
  }

  // 修改提醒周期步骤
  stepEditCron: (text: string) => void = (text) => {
    if (!this.newRemindItem || !this.remindItem) {
      this.logger.debug('出现错误，可能还没有选择要修改的内容')
      return
    }

    if (text === this.remindItem.cron) {
      this.logger.debug('新的周期和初始周期一样')
      this.bot.telegram.sendMessage(this.chatId, '新的提醒周期和初始提醒周期一样，请回复另一个', Markup.inlineKeyboard([[Markup.button.callback('返回', 'reselect_content_edit')]]))
      return
    }
    if (!nodeCron.validate(text)) {
      this.logger.debug(`新的周期不正确 chatid: ${this.chatId} newCron: ${text}`)
      this.bot.telegram.sendMessage(this.chatId, '提醒周期不正确，请回复另一个', Markup.inlineKeyboard([[Markup.button.callback('返回', 'reselect_content_edit')]]))
      return
    }

    this.newRemindItem.cron = text
    this.logger.debug(`获取到新的提醒周期 chatId: ${this.chatId} cron: ${this.remindItem.cron} -> ${this.newRemindItem.cron}`)
    const btnLine2: ReturnType<typeof Markup.button.callback>[] = []
    if (this.name !== this.prevName || this.remindItem.cron !== this.newRemindItem.cron || this.remindItem.text !== this.newRemindItem.text) {
      // 有项目被修改了，加入保存按钮
      btnLine2.push(Markup.button.callback('保存修改', 'save_edit'))
    }
    btnLine2.push(Markup.button.callback('取消修改', 'cancel_edit'))
    this.bot.telegram.sendMessage(this.chatId, `提醒项周期修改成了 ${this.newRemindItem.cron}\n下次提醒时间在: ${moment(cronParser.parseExpression(text).next().toISOString()).format('YYYY-MM-DD hh:mm:ss')}\n请选择要修改的字段`, Markup.inlineKeyboard([
      [Markup.button.callback('名称', 'name_edit'), Markup.button.callback('提醒内容', 'text_edit'), Markup.button.callback('提醒周期', 'cron_edit')],
      btnLine2
    ]))
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
    this.logger.info('提醒项存在，开始修改 chatid: ' + this.chatId)
    this.name = text
    this.prevName = text
    this.remindItem = remind
    this.newRemindItem = remind
    this.nowStep = 1
    await this.bot.telegram.sendMessage(this.chatId, '开始修改提醒项: ' + this.name, Markup.removeKeyboard())
    this.bot.telegram.sendMessage(this.chatId, '请选择要修改的字段', Markup.inlineKeyboard([
      [Markup.button.callback('名称', 'name_edit'), Markup.button.callback('提醒内容', 'text_edit'), Markup.button.callback('提醒周期', 'cron_edit')],
      [Markup.button.callback('重新选择要修改的项', 'reselect_item_edit'), Markup.button.callback('取消修改', 'cancel_edit')]
    ]))
  }

  // 保存修改
  saveEdit: () => boolean = () => {
    if (this.nowStep === 0 || !this.remindItem || !this.newRemindItem) {
      this.logger.error(`选择要修改的提醒项过程中收到了保存指令 chatid: ${this.chatId}`)
      this.bot.telegram.sendMessage(this.chatId, '你还在选择要修改的提醒项，没有进行任何修改，所以不需要保存')
      return false
    }
    const { notifyChatId: notifyId } = this.config
    this.logger.info(`正在保存修改 chatid: ${this.chatId}`)
    const reminds = readFromStoreFile(this.config.storeFile)
    if (reminds instanceof Error) {
      this.logger.error('读取存储文件时出错: ' + reminds.message)
      this.bot.telegram.sendMessage(this.chatId, '在保存提醒项时出错，这个问题已经同时进行了反馈')
      const notifyId = this.config.notifyChatId
      if (notifyId) {
        this.bot.telegram.sendMessage(notifyId, `在为 [${this.chatId}] 保存提醒项时出错了: ${reminds.message}`)
      }
      return false
    }
    const remindsForChat = reminds[this.chatId]
    if (!remindsForChat) {
      // 没有提醒项
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      this.bot.telegram.sendMessage(this.chatId, '在保存提醒项时出错，这个问题已经同时进行了反馈')
      if (notifyId) {
        this.bot.telegram.sendMessage(notifyId, `在为 [${this.chatId}] 保存提醒项时出错了: 原提醒项不存在，可能是在保存之前已经被修改过了`)
      }
      return false
    }
    const keys = Object.keys(reminds)
    if (keys.length === 0) {
      // 也没有提醒项
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      this.bot.telegram.sendMessage(this.chatId, '在保存提醒项时出错，这个问题已经同时进行了反馈')
      if (notifyId) {
        this.bot.telegram.sendMessage(notifyId, `在为 [${this.chatId}] 保存提醒项时出错了: 原提醒项不存在，可能是在保存之前已经被修改过了`)
      }
      return false
    }
    const remind = remindsForChat[this.prevName]
    if (!remind) {
      // 提醒项不存在
      this.logger.info('没有提醒项 chatid: ' + this.chatId)
      this.bot.telegram.sendMessage(this.chatId, '在保存提醒项时出错，这个问题已经同时进行了反馈')
      if (notifyId) {
        this.bot.telegram.sendMessage(notifyId, `在为 [${this.chatId}] 保存提醒项时出错了: 原提醒项不存在，可能是在保存之前已经被修改过了`)
      }
      return false
    }
    if (this.prevName === this.name) {
      // 名字相同，直接修改
      remind.cron = this.newRemindItem.cron
      remind.text = this.newRemindItem.text
      remindsForChat[this.prevName] = remind
    } else {
      // 名字不同，整个替换
      remindsForChat[this.prevName] = null
      remindsForChat[this.name] = this.newRemindItem
    }
    // 正式保存
    reminds[this.chatId] = remindsForChat
    const err = saveToStoreFile(reminds, this.config.storeFile)
    if (err) {
      this.bot.telegram.sendMessage(this.chatId, '在保存提醒项时出错，这个问题已经同时进行了反馈')
      if (notifyId) {
        this.bot.telegram.sendMessage(notifyId, `在为 [${this.chatId}] 保存提醒项时出错了: ${err.message}`)
      }
      return false
    }
    return true
  }
}
