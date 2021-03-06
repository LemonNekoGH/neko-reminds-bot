# neko-reminds-bot
有什么需要定时提醒的事情，交给我好了，设定的时间一到，我就会在对话中提醒你哦  
目前来看我还挺菜的，如果有什么事情做错了，去和 [柠喵](https://t.me/lemonneko) 说就好了，她说了会让我变得更厉害的

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
准备配置文件和数据存储文件（这一步以后再写）

运行
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
准备配置文件和数据存储文件（这一步以后再写）

运行容器
```shell
docker run -it -e REMINDS_BOT_CONFIG_PATH=<路径> -v <数据存储文件和配置文件所在的文件夹>:/app/shared
```

## 使用时除了以下情况，都可以给仓库发送 Issue
- 变成兔兔
- 变成猫猫
- 柠喵爆炸
- 被麻匪给劫了
- 遭遇电信诈骗
- Bot 提醒你色色
- 大都会过不了闸
- 香港记者向你提问
- 被面试官说 naive
- 饮料洒在了键盘上

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
