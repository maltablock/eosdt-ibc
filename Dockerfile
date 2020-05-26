FROM node:10-alpine

MAINTAINER "Aravind G V"

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

COPY .  /home/node/app/

WORKDIR /home/node/app/eosdt-ibc/reporter

RUN npm install

EXPOSE 8080

CMD [ "npm", "run", "start-dev" ]
