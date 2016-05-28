#!/bin/sh

#docker-machine create --driver virtualbox --virtualbox-hostonly-cidr "192.168.59.1/24" default
docker stop maphubs-tileserver
docker rm maphubs-tileserver
docker build --tag="maphubs-tileserver" .

docker run --name maphubs-tileserver -p 4001:4001 -d \
-e OMH_HOST=dev.docker \
-e OMH_PORT=4001 \
-e OMH_INTERNAL_PORT=4001 \
-e DB_USER=maphubs \
-e DB_PASS=maphubs \
-e DB_HOST=maphubs-db \
-e DB_PORT=5432 \
-e DB_DATABASE=maphubs \
--link=maphubs-db:maphubs-db \
maphubs-tileserver
