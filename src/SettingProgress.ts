import { Context, Markup } from 'telegraf'
import cron from 'node-cron'
import cronParser from 'cron-parser'
import { RemindItem, Reminds } from '.'
import fs from 'fs'
import { Logger } from 'log4js'
import moment from 'moment'

// 设置过程实体类
export class SettingProgress {
  step: number = 0;
  chatId: number;
  text: string = '';
  name: string = '';
  cron: string = '';
  stepName: string[] = [
    '提醒项名称',
    '提醒项内容',
    '提醒周期'
  ];

  replyText: string[] = [
    '请设置提醒项的名称',
    '请设置要提醒的内容',
    '请设置提醒周期: 一个 [cron 表达式](https://zh.wikipedia.org/wiki/Cron)'
  ];

  // 提醒设置所在的文件
  storeFile: string
  logger: Logger

  constructor (chatId: number, storeFile: string, logger: Logger) {
    this.chatId = chatId
    this.storeFile = storeFile
    this.logger = logger
  }

  // 设置提醒名步骤
  setNameStep (text: string, ctx: Context): void {
    this.name = text
    let callbackBtns = [Markup.button.callback('取消设置', 'cancel_setting')]
    if (this.step !== 0) {
      callbackBtns = [Markup.button.callback(`重新设置${this.stepName[this.step - 1]}`, 'prev_step_setting'), ...callbackBtns]
    }
    ctx.reply(`提醒项的名称已被设定为 ${text}\n${this.replyText[this.step + 1]}`, Markup.inlineKeyboard([callbackBtns]))
    this.step++
  }

  // 设置提醒内容步骤
  setTextStep (text: string, ctx: Context): void {
    this.text = text
    let callbackBtns = [Markup.button.callback('取消设置', 'cancel_setting')]
    if (this.step !== 0) {
      callbackBtns = [Markup.button.callback(`重新设置${this.stepName[this.step - 1]}`, 'prev_step_setting'), ...callbackBtns]
    }
    ctx.replyWithMarkdown(`提醒项的内容已被设定为 ${text}\n${this.replyText[this.step + 1]}`, Markup.inlineKeyboard([callbackBtns]))
    this.step++
  }

  // 设置提醒周期步骤
  setCornStep (text: string, ctx: Context): void {
    const result = cron.validate(text)
    if (result) {
      this.cron = text
      const nextRun = moment(cronParser.parseExpression(text).next().toISOString()).format('YYYY-MM-DD hh:mm:ss')
      ctx.reply(`提醒项的提醒周期已被设定为 ${text}\n下次提醒时间在 ${nextRun}`, Markup.inlineKeyboard([
        [Markup.button.callback('保存设置', 'save_setting')],
        [Markup.button.callback('重新设置提醒项内容', 'prev_step_setting')],
        [Markup.button.callback('取消设置', 'cancel_setting')]
      ]))
    } else {
      ctx.reply('cron 表达式解析错误，请重新设置', Markup.inlineKeyboard([
        [Markup.button.callback('重新设置提醒项内容', 'prev_step_setting')],
        [Markup.button.callback('取消设置', 'cancel_setting')]
      ]))
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
    replyText += this.replyText[this.step]
    let callbackBtns = [Markup.button.callback('取消设置', 'cancel_setting')]
    if (this.step !== 0) {
      callbackBtns = [Markup.button.callback(`重新设置${this.stepName[this.step - 1]}`, 'prev_step_setting'), ...callbackBtns]
    }
    this.logger.debug(`返回到了上一步：设置${this.stepName[this.step]}`)
    ctx.reply(replyText, Markup.inlineKeyboard([callbackBtns]))
  }

  // 保存设置到文件中
  save (): boolean | string {
    const remindItem: RemindItem = {
      text: this.text,
      cron: this.cron
    }
    try {
      const fileContent = fs.readFileSync(this.storeFile).toString()
      const dataObj = JSON.parse(fileContent) as Reminds
      let remindItemsForChatId = dataObj[this.chatId]
      // 检查这个 ChatID 是否从来没有设置过提醒项
      if (remindItemsForChatId) {
        remindItemsForChatId[this.name] = remindItem
      } else {
        remindItemsForChatId = {}
        remindItemsForChatId[this.name] = remindItem
      }
      dataObj[this.chatId] = remindItemsForChatId
      // 保存
      fs.writeFileSync(this.storeFile, JSON.stringify(dataObj, null, '  '))
      this.logger.debug('提醒数据保存成功')
      return true
    } catch (e) {
      let msg = ''
      if (e instanceof Error) {
        msg = e.message
      } else if (typeof e === 'string') {
        msg = e
      }
      if (!msg) {
        this.logger.warn('没有正确的获取到异常的类型')
      }
      this.logger.error(`在把提醒数据存储到 ${this.storeFile} 的过程出现了错误：${msg}`)
      return msg
    }
  }
}
