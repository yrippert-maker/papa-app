#!/usr/bin/env bash
set -euo pipefail

IMAGE="papa-app:smoke"
HOST_PORT=3001
# Next.js standalone слушает 3000 по умолчанию (Dockerfile EXPOSE 3000)
CONTAINER_PORT=3000

docker build -t "$IMAGE" .

CID=$(docker run -d -p "${HOST_PORT}:${CONTAINER_PORT}" \
  -e NEXTAUTH_SECRET=smoke-secret \
  -e WORKSPACE_ROOT=/tmp/data \
  "$IMAGE")

cleanup() {
  mkdir -p /tmp/smoke-docker-artifacts 2>/dev/null || true
  docker logs "$CID" 2>/dev/null > /tmp/smoke-docker-artifacts/container.log || true
  docker inspect "$CID" 2>/dev/null > /tmp/smoke-docker-artifacts/inspect.json || true
  docker rm -f "$CID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${HOST_PORT}/api/health" >/dev/null; then
    echo "OK: docker health"
    exit 0
  fi
  sleep 1
done

echo "FAIL: docker health not ready"
exit 1
