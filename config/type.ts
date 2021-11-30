import { HttpsProxyAgent } from 'https-proxy-agent'

export interface ProxyOptions {
    protocol: 'http' | 'https'
    host: string
    port: number
}

export interface DrinkBotConfig {
    token: string // Telegram Bot API Token
    storeFile: string // 数据存储文件
    webhookUrl?: string // 如果使用 Webhook，需提供地址
    httpsProxyAgent?: HttpsProxyAgent // 如果使用代理，请提供 @see HttpsProxyAgent 对象
    notifyChatId?: number // 启动时要提醒的聊天 id
}
