#!/bin/bash
set -euo pipefail

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPTS/.." && pwd)"
SERVER_PATH="$ROOT/too-many-cooks/build/bin/server_node.js"

if [ ! -f "$SERVER_PATH" ]; then
  echo "Server binary not found: $SERVER_PATH"
  echo "Build it first: cd $ROOT/too-many-cooks && dart compile js -o build/bin/server.js bin/server.dart"
  exit 1
fi

cleanup() { [ -n "${MCP_PID:-}" ] && kill "$MCP_PID" 2>/dev/null || true; }
trap cleanup EXIT

node "$SERVER_PATH" &
MCP_PID=$!

echo "MCP server started (PID: $MCP_PID)"
echo "Press Ctrl+C to stop"
wait "$MCP_PID"
