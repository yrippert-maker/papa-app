#!/bin/sh
# Build Lambda formatter (npm deps) before terraform apply
# Run when enable_lambda_formatter=true
# Детерминированная сборка: rm node_modules, npm ci

set -e
LAMBDA_DIR="$(dirname "$0")/../terraform/cloudfront-waf/lambda"
cd "$LAMBDA_DIR"

rm -rf node_modules
npm ci --omit=dev
