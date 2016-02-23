#!/bin/sh

#docker-machine create --driver virtualbox --virtualbox-hostonly-cidr "192.168.59.1/24" default
docker stop maphubs-tileserver
docker rm maphubs-tileserver
docker build --tag="maphubs-tileserver" .

docker run --name maphubs-tileserver -p 4001:4001 -d \
-e OMH_HOST=dev.docker \
-e OMH_PORT=4001 \
-e OMH_INTERNAL_PORT=4001 \
-e DB_USER=openmaphub \
-e DB_PASS=openmaphub \
-e DB_HOST=192.168.59.100 \
-e DB_PORT=5432 \
-e DB_DATABASE=openmaphub \
maphubs-tileserver
