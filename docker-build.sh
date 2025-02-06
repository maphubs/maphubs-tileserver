#!/bin/sh
docker buildx create --use --platform linux/amd64 --name multiplatform
docker buildx inspect --bootstrap
docker pull quay.io/maphubs/tiles:v0.12.1
docker buildx build --platform linux/amd64 --push -t kriscarle/mhp-v1-tileserver:v0.12.6 -f Dockerfile .
