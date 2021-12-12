import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { Logger } from 'log4js'
import fs from 'fs'
import { Reminds } from '../src'

export interface IDrinkBotConfig {
    token: string // Telegram Bot API Token
    storeFile: string // 数据存储文件
    webhookUrl?: string // 如果使用 Webhook，需提供地址
    httpsProxyAgent?: HttpsProxyAgent // 如果使用代理，请提供 @see HttpsProxyAgent 对象
    notifyChatId?: number // 启动时要提醒的聊天 id
}

// 配置文件实体类
export class DrinkBotConfig implements IDrinkBotConfig {
    token: string;
    storeFile: string;
    webhookUrl?: string;
    httpsProxyAgent?: HttpsProxyAgent
    notifyChatId?: number

    // 从配置文件结构创建配置文件实体类
    constructor ({ token, storeFile, webhookUrl, httpsProxyAgent, notifyChatId }: IDrinkBotConfig) {
      this.token = token
      this.storeFile = storeFile
      this.webhookUrl = webhookUrl
      this.httpsProxyAgent = httpsProxyAgent
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

  try {
    const { config: c } = await import('./config')
    config = c
    logger.debug('配置文件获取成功')
  } catch (e) {
    logger.error('配置文件获取失败，请根据 config 文件夹中的 config.ts.example 创建 config.ts')
    return null
  }

  return new DrinkBotConfig(config as IDrinkBotConfig)
}
