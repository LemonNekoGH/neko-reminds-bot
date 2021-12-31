import log4js from 'log4js'
import cron from 'node-cron'
import { Telegraf } from 'telegraf'
import { RemindItem } from './DataStore'
import cronParser, { CronExpression } from 'cron-parser'
import moment from 'moment'

// 提醒任务实例
export class NotifyTask {
    private chatId: number
    private name: string
    private cronExp: string
    private notifyStr: string
    private parsedCron: CronExpression
    private task: cron.ScheduledTask
    private bot: Telegraf
    private logger: log4js.Logger

    constructor (chatId: number, name: string, remindItem: RemindItem, bot: Telegraf, logger: log4js.Logger) {
      this.chatId = chatId
      this.name = name
      this.cronExp = remindItem.cron
      this.notifyStr = remindItem.text
      this.bot = bot
      this.logger = logger
      this.parsedCron = cronParser.parseExpression(this.cronExp)
      // 初始化任务内容
      this.task = cron.schedule(this.cronExp, this.taskContent, { scheduled: false })
    }

    // 任务内容
    private taskContent: () => Promise<void> = async () => {
      try {
        this.logger.debug(`开始发送提醒 chatid: ${this.chatId}, name: ${this.name}`)
        await this.bot.telegram.sendMessage(this.chatId, this.notifyStr)
        this.logger.debug(`提醒发送完毕 chatid: ${this.chatId}, name: ${this.name}, 下次提醒时间: ${moment(this.parsedCron.next().toISOString()).format('YYYY-MM-DD hh:mm:ss')}`)
      } catch (e) {
        this.logger.error('提醒发送失败')
      }
    }

    // 更新提醒项内容
    updateRemindItem: (remindItem: RemindItem) => void = (item) => {
      // 停止任务
      this.stop()
      // 更新内容
      this.logger.debug(`提醒项已更新 chatid: ${this.chatId}, name: ${this.name}, cron: ${this.cronExp} -> ${item.cron}, text: ${this.notifyStr} -> ${item.text}`)
      this.cronExp = item.cron
      this.notifyStr = item.text
      this.parsedCron = cronParser.parseExpression(this.cronExp)
      this.task = cron.schedule(this.cronExp, this.taskContent, { scheduled: false })
      // 开始任务
      this.start()
    }

    // 启动任务
    start: () => void = () => {
      this.task.start()
      this.logger.debug(`已启动提醒任务 chatid: ${this.chatId}, name: ${this.name}, 下次提醒时间: ${moment(this.parsedCron.next().toISOString()).format('YYYY-MM-DD hh:mm:ss')}`)
    }

    // 停止任务
    stop: () => void = () => {
      this.task.stop()
      this.logger.debug(`已停止提醒任务 chatid: ${this.chatId}, name: ${this.name}`)
    }

    // 检查是否与指定提醒项相同
    equalsTo: (item: RemindItem) => boolean = (item) => {
      return this.notifyStr === item.text && this.cronExp === item.cron
    }

    get notifyContent (): string {
      return this.notifyStr
    }

    /**
     * 获取下次运行的时间
     */
    nextRunTime: () => string = () => {
      return moment(this.parsedCron.next().toISOString()).format('YYYY 年 MM 月 DD 日 HH:mm:ss')
    }
}
