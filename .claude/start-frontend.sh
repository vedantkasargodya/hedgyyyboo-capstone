#!/bin/bash
export PATH="/usr/local/bin:$PATH"
cd "$(dirname "$0")/../hedgyyyboo-frontend"
exec npx next dev
