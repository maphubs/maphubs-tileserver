FROM ubuntu:16.04

ENV DEBIAN_FRONTEND noninteractive

#MapHubs - Tile Server
MAINTAINER Kristofor Carle - Moabi <kristoforcarle@moabi.org>

#update and install basics
RUN apt-get update && apt-get install -y wget git curl libssl-dev openssl python build-essential g++ libpq-dev \
&& apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

#install node, npm, pm2
RUN curl -sL https://deb.nodesource.com/setup_4.x | bash
RUN apt-get install -y nodejs \
&& apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
RUN npm install -g npm && npm install pm2 -g

#create non-root user
RUN useradd -s /bin/bash -m -d /home/maphubs -c "maphubs" maphubs && chown -R maphubs:maphubs /home/maphubs

#switch over and do everything else as the non-priledged user
USER maphubs

RUN mkdir -p /home/maphubs/app
WORKDIR /home/maphubs/app

COPY package.json /home/maphubs/app/package.json
RUN npm install


USER root
COPY . /home/maphubs/app
RUN chown -R maphubs:maphubs /home/maphubs/app
RUN chmod +x /home/maphubs/app/docker-entrypoint.sh

#copy environment specific config file
COPY env/deploy_local.js  /home/maphubs/app/local.js
RUN chown maphubs:maphubs /home/maphubs/app/local.js


#build client-side files
USER maphubs

EXPOSE 4001
ENV NODE_ENV production

ENV DEBUG *,-express:*,-morgan,-tessera,-pool2,-knex:*,-pm2:*
CMD /home/maphubs/app/docker-entrypoint.sh
