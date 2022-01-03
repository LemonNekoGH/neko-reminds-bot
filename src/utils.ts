import { Reminds } from './DataStore'
import fs from 'fs'
import cronParser from 'cron-parser'
import moment from 'moment'

// 把提醒项保存到文件中
export const saveToStoreFile: (reminds: Reminds, storeFile: string) => (Error | null) = (remind, storeFile) => {
  try {
    fs.writeFileSync(storeFile, JSON.stringify(remind, undefined, '  '))
  } catch (e) {
    return e as Error
  }
  return null
}

// 从文件中读取提醒项
export const readFromStoreFile: (storeFile: string) => (Reminds | Error) = (storeFile) => {
  let reminds: Reminds = {}
  try {
    reminds = JSON.parse(fs.readFileSync(storeFile).toString()) as Reminds
  } catch (e) {
    return e as Error
  }
  return reminds
}

/**
 * 给一个 cron 表达式，获取这个表达式的下一次运行时间
 */
export const getNextRunTime: (str: string) => string = (str) => {
  return moment(cronParser.parseExpression(str).next().toISOString()).format('YYYY-MM-DD hh:mm:ss')
}
