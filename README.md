# neko-reminds-bot
一个简易的用于在 Telegram 中设置提醒的 Bot，当提醒时间到时会向群组发送指定消息。待重写。

## 使用方法
把 Bot 添加到你的群组，或直接与 Bot 聊天  
支持以下指令：
- new 为这个对话设置新的提醒项
- edit 修改提醒项
- setContent 为某个提醒项设置新的内容
- setCycle 为某个提醒项设置新的周期
- delete 删除某个提醒项
- import 导入提醒项
- export 导出提醒项
- utils 一些小工具
- info 显示相关信息
- help 显示帮助信息
- +1s 搞一个大新闻
## 自己部署的方法
### 直接运行
需要先安装 Node.js 14

拉取此仓库
```shell
git clone https://github.com/LemonNekoGH/neko-time-to-drink-bot
```
安装依赖
```shell
npm install
```
准备好配置文件和数据存储文件之后运行以下命令
```shell
npm run dev
```
### Docker 方式
需要先安装 Docker  

拉取此仓库
```shell
git clone https://github.com/LemonNekoGH/neko-time-to-drink-bot
```

构建镜像
```shell
docker build . -t neko-reminds-bot
```
准备好配置文件和数据存储文件之后运行容器
```shell
docker run -it -e REMINDS_BOT_CONFIG_PATH=<路径> -v <数据存储文件和配置文件所在的文件夹>:/app/shared
```
## 配置文件与数据文件
它们都是 `json` 格式
```shell
$ mkdir drink-bot-data && cd drink-bot-data
$ touch config.json data.json
```
编写配置文件，这是模板
```json5
{
    "token": "", // Telegram Bot API Token
    "storeFile": "./data.json", // 数据存储文件路径，也可以指定其它路径
    "webhookUrl": "", // 如果使用 Webhook，需提供地址，如果不需要，可以删除此字段
    "proxyUrl": "", // 如果使用代理，请提供代理地址，如果不需要，可以删除此字段
    "notifyChatId": 0 // 启动时要提醒的聊天 id，在启动后会发送一条提醒到指定的聊天，如果不需要，可以删除此字段
}
```

## 已知特性
- [ ] 被添加到群组里后，所有人都可以设置提醒项
- [ ] 需要设置提醒周期的时候使用的是 cron 表达式，可能会劝退一部分用户
- [ ] 提醒周期修改之后不会显示保存按钮
- [ ] 只有中国时区

## TODO-List
- [ ] 群组权限控制
- [ ] 删除命令
- [ ] 导入命令
- [ ] 导出命令
- [ ] 小工具
- [ ] 改用数据库存数据
- [ ] 某段时间内不再提醒
- [ ] 用提问的方式设置提醒周期
- [ ] 写使用文档
