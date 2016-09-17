FROM ubuntu:16.04

ENV DEBIAN_FRONTEND noninteractive

#MapHubs - Tile Server
MAINTAINER Kristofor Carle - MapHubs <kris@maphubs.com>

#update and install basics
RUN apt-get update && apt-get install -y wget git curl libssl-dev openssl python build-essential g++ libpq-dev \
&& apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

#install node, npm, pm2
RUN curl -sL https://deb.nodesource.com/setup_4.x | bash
RUN apt-get install -y nodejs \
&& apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
RUN npm install pm2 -g

RUN mkdir -p /app
WORKDIR /app

COPY package.json /app/package.json
RUN npm install

COPY . /app
RUN chmod +x /app/docker-entrypoint.sh

#copy environment specific config file
COPY env/deploy_local.js  /app/local.js

EXPOSE 4001
ENV NODE_ENV production

ENV DEBUG *,-express:*,-morgan,-tessera,-pool2,-knex:*,-pm2:*
CMD /app/docker-entrypoint.sh
