FROM node:10-alpine

MAINTAINER "Aravind G V"

RUN apk update

RUN apk add --no-cache bash

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

COPY .  /home/node/app/

WORKDIR /home/node/app/eosdt-ibc/reporter

RUN npm install

RUN npm run build

CMD [ "/bin/bash","-c","/home/node/app/eosdt-ibc/reporter/run.sh"]
