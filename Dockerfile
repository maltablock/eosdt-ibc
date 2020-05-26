FROM node:10-alpine

MAINTAINER "Aravind G V"

RUN mkdir -p /home/node/app && chown -R node:node /home/node/app

COPY .  /home/node/app/

WORKDIR /home/node/app/eosdt-ibc/reporter

RUN npm install

CMD [ "npm", "run", "start-dev" ]
