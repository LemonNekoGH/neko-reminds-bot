import { Logger } from 'log4js'
import { DrinkBotConfig } from '../config'
import fs from 'fs'

export interface RemindItem {
  text: string
  cron: string
}

export interface RemindsForChat {
  [p: string]: RemindItem | null
}

// 提醒项存储在文件中的样子
export interface Reminds {
// ChatID
  [p: number]: RemindsForChat
}

// 数据存取辅助类
// 用完就回收，不要长期保存实例
export class DataStore {
  private config: DrinkBotConfig
  private remindsData: Map<number, Map<string, RemindItem>> = new Map()
  private logger: Logger

  // 请在创建实例时捕获错误
  constructor (config: DrinkBotConfig, logger: Logger) {
    this.config = config
    this.logger = logger
    // 读取数据
    this.readStoreFile()
    // 构建完毕
    this.logger.debug('数据存取辅助类实例已创建')
  }

  // 读取数据
  // 只会在实例创建的时候调用一次
  private readStoreFile: () => void = () => {
    this.logger.info('开始读取提醒项数据')
    const fileContent = JSON.parse(fs.readFileSync(this.config.storeFile).toString()) as Reminds
    // 转换成 Map
    for (const chatId in fileContent) {
      const remindsForChat = fileContent[chatId]
      if (remindsForChat) {
        const map = new Map<string, RemindItem>()
        for (const name in remindsForChat) {
          const remind = remindsForChat[name]
          if (remind) {
            map.set(name, remind)
          }
        }
        this.remindsData.set(parseInt(chatId), map)
      }
    }
    this.logger.info('提醒项数据读取成功')
  }

  // 保存数据
  // 保存完之后就请新建一个实例
  // 需要捕获错误
  save: () => void = () => {
    this.logger.info('开始保存提醒项数据')
    // 转换成存储时使用的数据结构
    const reminds: Reminds = {}
    this.remindsData.forEach((value, key) => {
      const remindsForChat: RemindsForChat = {}
      value.forEach((remind, name) => {
        remindsForChat[name] = remind
      })
      reminds[key] = remindsForChat
    })
    // 存储
    fs.writeFileSync(this.config.storeFile, JSON.stringify(reminds))
    this.logger.info('提醒项数据保存成功')
  }

  // 获取所有提醒项名称列表
  getRemindsListForChat: (chatId: number) => string[] = (chatId) => {
    const remindForChat = this.remindsData.get(chatId)
    const result: string[] = []
    if (remindForChat) {
      remindForChat.forEach((_, key) => {
        result.push(key)
      })
    }
    return result
  }

  // 通过名字获取提醒项
  // 正常时返回提醒项
  // 没有获取到这个名字的提醒项时返回 undefined
  // 没有读取到这个对话的提醒项时报错
  getRemindItem: (chatId: number, name: string) => RemindItem | undefined = (chatId, name) => {
    const remindsForChat = this.remindsData.get(chatId)
    if (remindsForChat) {
      return remindsForChat.get(name)
    }
    throw new Error('没有为这个对话设置提醒项')
  }

  // 提醒项名称是否存在
  // 没有读取到提醒项时报错
  isRemindItemNameExists: (chatId: number, name: string) => boolean = (chatId, name) => {
    const remindForChat = this.remindsData.get(chatId)
    if (remindForChat) {
      return !!remindForChat.get(name)
    }
    throw new Error('没有为这个对话设置提醒项')
  }

  // 修改或新增提醒项
  // 新增提醒项时 ignoreExists 应该传入 true
  // 修改提醒项时，没有读取到提醒项时报错
  setRemindItem: (chatId: number, name: string, item: RemindItem, ignoreNotExists?: boolean) => void = (chatId, name, item, ignoreNotExists = false) => {
    let remindsForChat = this.remindsData.get(chatId)
    if (!remindsForChat) {
      if (!ignoreNotExists) {
        throw new Error('没有为这个对话设置提醒项')
      }
      // 创建新的提醒项集合
      remindsForChat = new Map()
    }
    remindsForChat.set(name, item)
    this.remindsData.set(chatId, remindsForChat)
  }

  // 删除提醒项
  deleteRemindItem: (chatId: number, name: string) => void = (chatId, name) => {
    const remindsForChat = this.remindsData.get(chatId)
    if (!remindsForChat) {
      return
    }
    remindsForChat.delete(name)
    this.remindsData.set(chatId, remindsForChat)
  }
}
