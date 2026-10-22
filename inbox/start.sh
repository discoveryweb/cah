#!/usr/bin/env bash
# Start (or restart) the upload inbox on port 8787.
set -euo pipefail
cd "$(dirname "$0")"
exec node server.mjs
