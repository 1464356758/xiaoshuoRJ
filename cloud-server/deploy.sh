#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
if ! command -v docker >/dev/null 2>&1; then
  echo '请先使用云服务商的Docker镜像或安装Docker Engine和Compose。'
  exit 1
fi
if [[ $# -gt 0 ]]; then
  host=$1
  if [[ ! $host =~ ^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$ || $host != *.* ]]; then
    echo '参数应为指向本服务器的域名，例如 novel.example.com，不含https和路径。'
    exit 1
  fi
  if [[ -e .env ]] && ! [[ $(cat .env) == "PUBLIC_HOST=$host" ]]; then
    echo '已有不同域名配置，请先核对.env；原数据未变。'
    exit 1
  fi
  umask 077
  printf 'PUBLIC_HOST=%s\n' "$host" > .env
fi
if [[ ! -f .env ]]; then echo '第一次运行需提供自己的域名：bash deploy.sh novel.example.com'; exit 1; fi
docker compose --env-file .env -f compose.yaml up -d --build
echo '服务启动后，在自己的云终端读取连接信息：'
echo 'docker compose --env-file .env -f compose.yaml exec -T api node cloud-server/admin.mjs pairing'
