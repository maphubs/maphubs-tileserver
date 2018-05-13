FROM oinuar/alpine-node-mapnik as base

LABEL maintainer="Kristofor Carle <kris@maphubs.com>"

ENV NODE_ENV=production

RUN apk add --no-cache --upgrade apk-tools --repository http://nl.alpinelinux.org/alpine/edge/testing && \
    apk add --no-cache gdal postgresql-dev libc6-compat --repository http://nl.alpinelinux.org/alpine/edge/testing && \
    mkdir -p /app

WORKDIR /app

FROM base AS dependencies

RUN apk add --no-cache make gcc g++ python 

COPY package.json .snyk /app/
RUN npm install --production && \
    npm run snyk-protect

RUN cp -r /opt/node-mapnik/*  /app/node_modules/@mapbox/tilelive-bridge/node_modules/mapnik/

FROM base AS release 
COPY --from=dependencies /app /app
COPY ./env /app/env
COPY ./models /app/models
COPY ./routes /app/routes
COPY ./services /app/services
COPY app.js connection.js docker-entrypoint.sh /app/

RUN chmod +x /app/docker-entrypoint.sh && \
    cp /app/env/deploy_local.js  /app/local.js

EXPOSE 4001
VOLUME /data
CMD /app/docker-entrypoint.sh