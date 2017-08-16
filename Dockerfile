FROM ubuntu:16.04

ENV DEBIAN_FRONTEND=noninteractive NODE_ENV=production

#MapHubs - Tile Server
MAINTAINER Kristofor Carle - MapHubs <kris@maphubs.com>

#install dependencies
RUN apt-get update && apt-get install -y curl libssl-dev openssl python build-essential g++ libpq-dev && \
    curl -sL https://deb.nodesource.com/setup_8.x | bash && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    mkdir -p /app

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    apt-get update && apt-get install -y yarn && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

COPY package.json yarn.lock .snyk /app/
RUN yarn install --production --pure-lockfile

RUN npm run snyk-protect

COPY . /app
RUN chmod +x /app/docker-entrypoint.sh &&\
    cp /app/env/deploy_local.js  /app/local.js

EXPOSE 4001
VOLUME /data
CMD /app/docker-entrypoint.sh
