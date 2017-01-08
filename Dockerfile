FROM ubuntu:16.04

ENV DEBIAN_FRONTEND=noninteractive NODE_ENV=production DEBUG=maphubs:*

#MapHubs - Tile Server
MAINTAINER Kristofor Carle - MapHubs <kris@maphubs.com>

#install dependencies
RUN apt-get update && apt-get install -y wget git curl libssl-dev openssl python build-essential g++ libpq-dev && \
    curl -sL https://deb.nodesource.com/setup_4.x | bash && \
    apt-get install -y nodejs && \
    npm install -g yarn@0.16.1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    mkdir -p /app

WORKDIR /app

COPY package.json yarn.lock /app/
RUN yarn install --production --pure-lockfile

COPY . /app
RUN chmod +x /app/docker-entrypoint.sh &&\
    cp /app/env/deploy_local.js  /app/local.js

EXPOSE 4001
VOLUME /data
CMD /app/docker-entrypoint.sh
