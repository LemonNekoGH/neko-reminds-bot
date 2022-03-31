import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { Logger } from 'log4js'
import fs from 'fs'
import { Reminds } from '../src/DataStore'

export interface IDrinkBotConfig {
    token: string // Telegram Bot API Token
    storeFile: string // 数据存储文件
    webhookUrl?: string // 如果使用 Webhook，需提供地址
    proxyUrl?: string // 如果使用代理，请提供代理地址
    notifyChatId?: number // 启动时要提醒的聊天 id
}

// 配置文件实体类
export class DrinkBotConfig implements IDrinkBotConfig {
    token: string
    storeFile: string
    webhookUrl?: string
    httpsProxyAgent?: HttpsProxyAgent
    notifyChatId?: number

    // 从配置文件结构创建配置文件实体类
    constructor ({ token, storeFile, webhookUrl, proxyUrl, notifyChatId }: IDrinkBotConfig) {
      this.token = token
      this.storeFile = storeFile
      this.webhookUrl = webhookUrl
      this.httpsProxyAgent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined
      this.notifyChatId = notifyChatId
    }

    // 验证可用性
    verify: (logger: Logger) => Promise<boolean> = async (logger) => {
      logger.debug('开始校验配置文件正确性')
      const { token, storeFile, httpsProxyAgent } = this
      // 测试代理
      if (httpsProxyAgent) {
        try {
          const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`, { httpsAgent: httpsProxyAgent })
          if (!res.data || !res.data.ok) {
            logger.error('代理测试成功，但是返回错误')
          }
          logger.debug('代理测试成功')
        } catch (e) {
          let msg = ''
          if (e instanceof Error) {
            msg = e.message
          }
          if (msg === '') {
            logger.warn('没有正确获取到错误类型')
          }
          logger.error('代理测试失败：' + msg)
          return false
        }
      }
      // 测试数据文件
      try {
        // 尝试读取
        const content = fs.readFileSync(storeFile).toString()
          JSON.parse(content) as Reminds
          logger.debug('数据存储文件配置正确')
      } catch (e) {
        let msg = ''
        if (e instanceof Error) {
          msg = e.message
        }
        if (msg === '') {
          logger.warn('没有正确获取到错误类型')
        }
        logger.error('数据存储文件配置不正确：' + msg)
        return false
      }
      logger.debug('配置文件校验成功')
      return true
    }
}

export const readConfig: (logger: Logger) => Promise<DrinkBotConfig | null> = async (logger) => {
  // 获取配置文件
  let config: IDrinkBotConfig | null = null
  // 尝试从参数中获取配置文件位置
  let configPath = ''
  for (let arg in process.argv) {
    if (process.argv[arg].startsWith('--config=')) {
      configPath = process.argv[arg].slice('--config='.length)
      break
    }
  }
  if (!configPath) {
    logger.info('没有从参数中找到配置文件的位置')
    // 尝试从环境变量中获取配置文件的位置
    configPath = process.env.REMINDS_BOT_CONFIG_PATH ?? ''
    if (!configPath) {
      logger.error('没有从环境变量中找到配置文件的位置，无法继续')
      process.exit(1)
    } else {
      logger.info('从环境变量中找到了配置文件的位置：' + configPath)
    }
  } else {
    logger.info('从参数中找到了配置文件的位置：' + configPath)
  }
  // 尝试读取配置文件
  try {
    const content = fs.readFileSync(configPath)
    config = JSON.parse(content.toString()) as IDrinkBotConfig
    return new DrinkBotConfig(config)
  } catch (e) {
    const err = e as Error
    logger.error('配置文件读取失败：' + err.name + ' ' + err.message)
    process.exit(1)
  }
}
