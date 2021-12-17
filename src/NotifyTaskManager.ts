import log4js from 'log4js'
import fs from 'fs'
import { Telegraf } from 'telegraf'
import { Reminds } from '.'
import { NotifyTask } from './NotifyTask'

// 提示任务管理器
export class NotifyTaskManager {
    logger: log4js.Logger // 日志记录工具
    taskMap: Map<number, Map<string, NotifyTask>> = new Map() // 用于存储提醒任务
    bot: Telegraf // 机器人实例

    // 初始化任务管理器
    constructor (bot: Telegraf, logger: log4js.Logger) {
      this.bot = bot
      this.logger = logger
    }

    // 初始化或更新任务
    // @params storeFile 提醒存储文件
    initOrUpdateTasks: (storeFile: string) => void = (storeFile) => {
      this.logger.info('开始初始化/更新提醒任务')
      // 读取存储文件
      let fileContent: Reminds | undefined
      try {
        fileContent = JSON.parse(fs.readFileSync(storeFile).toString()) as Reminds
      } catch (e) {
        this.logger.error('初始化/更新提醒任务失败:' + (e as Error).message)
        return
      }
      this.logger.debug('读取存储文件成功')
      const reminds = fileContent as Reminds
      // 检查现有提醒项是否被修改
      this.taskMap.forEach((tasksForChat, chatId) => {
        const remindsForChat = reminds[chatId]
        if (!remindsForChat) {
          // 如果这个 chatid 的所有提醒项消失，删除所有提醒任务
          tasksForChat.forEach(task => task.stop())
          this.taskMap.delete(chatId)
        } else {
          // 如果还存在，检查是否需要更新
          tasksForChat.forEach((task, name) => {
            const remind = remindsForChat[name]
            if (!remind) {
              // 如果这个提醒项消失，删除提醒任务
              task.stop()
              tasksForChat.delete(name)
            } else {
              // 如果还存在，检查是否需要更新
              if (!task.equalsTo(remind)) {
                task.updateRemindItem(remind)
              }
            }
          })
        }
      })
      // 检查是否有新的提醒项
      for (const chatId in reminds) {
        const remindsForChat = reminds[chatId]
        let tasksForChat = this.taskMap.get(parseInt(chatId))
        this.logger.debug(`正在检查提醒项有没有被加入任务 chatid: ${chatId}, added: ${typeof tasksForChat === 'object'}`)
        if (!tasksForChat) {
          // 这个聊天的提醒项没有被加入任务
          this.logger.debug(`这个聊天的提醒项都没有被加入任务 chatid: ${chatId}`)
          tasksForChat = new Map()
          for (const name in remindsForChat) {
            const remindItem = remindsForChat[name]
            if (remindItem) {
              const task = new NotifyTask(parseInt(chatId), name, remindItem, this.bot, this.logger)
              task.start()
              tasksForChat.set(name, task)
            }
          }
          this.taskMap.set(parseInt(chatId), tasksForChat)
          this.logger.debug(`任务已加入 chatid: ${chatId}`)
        } else {
          // 检查聊天有没有新的提醒项
          for (const name in remindsForChat) {
            const remindItem = remindsForChat[name]
            if (!tasksForChat.get(name)) {
              // 有新的提醒项
              if (remindItem) {
                const task = new NotifyTask(parseInt(chatId), name, remindItem, this.bot, this.logger)
                task.start()
                tasksForChat.set(name, task)
                this.logger.debug(`已添加 chatid: ${chatId}, name: ${name}`)
              }
            }
          }
        }
      }
      this.logger.debug('提醒任务初始化/更新完毕')
    }
}
