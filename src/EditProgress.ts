import { Markup, Telegraf } from 'telegraf'
import { DataStore, RemindItem } from './DataStore'
import { getNextRunTime, readFromStoreFile, saveToStoreFile } from './utils'
import { Logger } from 'log4js'
import { DrinkBotConfig } from '../config'
import nodeCron from 'node-cron'
import cronParser from 'cron-parser'
import moment from 'moment'
import { createHistogram } from 'perf_hooks'

// 修改提醒项
export class EditProgress {
  bot: Telegraf // bot 实例
  remindName: string = '' // 正在修改的提醒项名称
  chatId: number // 正在请求修改的对话 id
  logger: Logger
  config: DrinkBotConfig
  waitFor: 'cycle' | 'content' | 'selectAction' | 'selectRemind' = 'selectRemind'

  constructor (bot: Telegraf, logger: Logger, config: DrinkBotConfig, chatId: number) {
    this.bot = bot
    this.logger = logger
    this.config = config
    this.chatId = chatId
  }

  /**
   * 收到消息之后
   * @param text
   */
  receivedText: (text: string) => void = (text) => {
    switch (this.waitFor) {
      case 'cycle': this.receivedNewCycle(text); break
      case 'content': this.receivedNewContent(text); break
    }
  }

  /**
   * 确保当前提醒项还存在
   */
  requireRemindExists: () => RemindItem | undefined = () => {
    const dataStore = new DataStore(this.config, this.logger)
    const remind = dataStore.getRemindItem(this.chatId, this.remindName)
    if (!remind) {
      this.bot.telegram.sendMessage(this.chatId, `提醒项 [${this.remindName}] 已经不存在了`)
      return undefined
    }
    return remind
  }

  /**
   * 收到新周期
   */
  receivedNewCycle: (text: string) => void = (text) => {
    const remind = this.requireRemindExists()
    if (!remind) {
      return
    }
    // 检查周期是否正确
    try {
      cronParser.parseExpression(text)
    } catch (e) {
      // 周期错误，告诉用户重新发一个
      this.bot.telegram.sendMessage(this.chatId, text + ' 不是一个正确的 cron 表达式，请检查之后再发送一个')
      return
    }
    // 正确，进行修改
    remind.cron = text
    const dataStore = new DataStore(this.config, this.logger)
    dataStore.setRemindItem(this.chatId, this.remindName, remind)
    dataStore.save()
    // 发送修改成功消息
    const message = `提醒周期修改完毕\n当前提醒项: ${this.remindName}\n\n提醒周期 cron 表达式: ${remind.cron}\n提醒内容: ${remind.text}\n下次提醒时间: ${getNextRunTime(remind.cron)}\n你可以进行以下操作: `
    const markupBtns = [
      [Markup.button.callback('修改提醒周期', `edit.cron.${this.remindName}`)],
      [Markup.button.callback('修改提醒内容', `edit.content.${this.remindName}`)],
      [Markup.button.callback('« 返回提醒项列表', 'edit.back')]
    ]
    // 回复消息
    this.bot.telegram.sendMessage(this.chatId, message, Markup.inlineKeyboard(markupBtns)).then(() => {
      // 发送成功后更新修改过程
      this.waitFor = 'selectAction'
    })
  }

  /**
   * 收到新内容
   */
  receivedNewContent: (text: string) => void = (text) => {
    const remind = this.requireRemindExists()
    if (!remind) {
      return
    }
    // 进行修改
    remind.text = text
    const dataStore = new DataStore(this.config, this.logger)
    dataStore.setRemindItem(this.chatId, this.remindName, remind)
    dataStore.save()
    // 发送修改成功消息
    const message = `提醒内容修改完毕\n当前提醒项: ${this.remindName}\n\n提醒周期 cron 表达式: ${remind.cron}\n提醒内容: ${remind.text}\n下次提醒时间: ${getNextRunTime(remind.cron)}\n你可以进行以下操作: `
    const markupBtns = [
      [Markup.button.callback('修改提醒周期', `edit.cron.${this.remindName}`)],
      [Markup.button.callback('修改提醒内容', `edit.content.${this.remindName}`)],
      [Markup.button.callback('« 返回提醒项列表', 'edit.back')]
    ]
    // 回复消息
    this.bot.telegram.sendMessage(this.chatId, message, Markup.inlineKeyboard(markupBtns)).then(() => {
      // 发送成功后更新修改过程
      this.waitFor = 'selectAction'
    })
  }
}
