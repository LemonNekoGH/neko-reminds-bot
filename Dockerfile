FROM node:16

WORKDIR /app/

COPY . .

# 初始化时把时区设置到 UTC+8
# 需要其它时区的话请修改这一部分
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
RUN echo 'Asia/Shanghai' > /etc/timezone

RUN yarn

CMD ["yarn", "dev"]