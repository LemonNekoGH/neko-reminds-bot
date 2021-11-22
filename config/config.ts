import HttpsProxyAgent from 'https-proxy-agent/dist/agent'
import path from 'path'
import { DrinkBotConfig } from './type'

export const config: DrinkBotConfig = {
  token: '2076456821:AAFb01mBQEczbZgGFFnnAph-WCcWGAb0iDc',
  storeFile: path.resolve('../testStore.json'),
  httpsProxyAgent: new HttpsProxyAgent('http://localhost:10080'),
  notifyChatId: -1001339182180
}
