FROM ubuntu:trusty

ENV DEBIAN_FRONTEND noninteractive

#MapHubs - Tile Server
MAINTAINER Kristofor Carle - Moabi <kristoforcarle@moabi.org>

#update and install basics
RUN apt-get update && apt-get install -y wget git curl libssl-dev openssl nano unzip python build-essential g++ gdal-bin

#install node, npm, pm2
RUN curl -sL https://deb.nodesource.com/setup_4.x | bash
RUN apt-get install -y nodejs
RUN npm install -g npm && npm install pm2 -g

#create non-root user
RUN useradd -s /bin/bash -m -d /home/openmaphub -c "openmaphub" openmaphub && chown -R openmaphub:openmaphub /home/openmaphub

#switch over and do everything else as the non-priledged user
USER openmaphub

RUN mkdir -p /home/openmaphub/app
WORKDIR /home/openmaphub/app

COPY package.json /home/openmaphub/app/package.json
RUN npm install


USER root
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
COPY . /home/openmaphub/app
RUN chown -R openmaphub:openmaphub /home/openmaphub/app
RUN chmod +x /home/openmaphub/app/docker-entrypoint.sh

#copy environment specific config file
COPY env/deploy_local.js  /home/openmaphub/app/local.js
RUN chown openmaphub:openmaphub /home/openmaphub/app/local.js


#build client-side files
USER openmaphub

EXPOSE 4001
ENV NODE_ENV production

ENV DEBUG *,-express:*,-morgan,-tessera,-pool2,-knex:*,-pm2:*
CMD /home/openmaphub/app/docker-entrypoint.sh
