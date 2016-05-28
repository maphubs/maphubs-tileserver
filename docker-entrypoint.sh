#!/bin/sh
pm2 start app.js --name maphubs-tileserver --node-args="--max-old-space-size=$NODE_MEM_SIZE" --no-daemon
