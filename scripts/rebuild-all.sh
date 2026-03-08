#!/bin/bash
set -euo pipefail

SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPTS/.." && pwd)"
DART_NODE="$(cd "$ROOT/../dart_node" && pwd)"
MCP_DIR="$ROOT/too_many_cooks"
VSIX_DIR="$ROOT/too_many_cooks_vscode_extension"
SERVER_BINARY="build/bin/server_node.js"
PORT=4040

echo "=== Clean ==="
rm -rf "$MCP_DIR/build"
rm -rf "$MCP_DIR/.too_many_cooks"
rm -rf "$VSIX_DIR/out"
rm -rf "$VSIX_DIR/.too_many_cooks"
echo "Cleaned build artifacts and databases"

echo ""
echo "=== Build MCP server (Dart → JS) ==="
cd "$MCP_DIR"
dart pub get
dart compile js -o build/bin/server.js bin/server.dart
cd "$DART_NODE"
dart run tools/build/add_preamble.dart \
  "$MCP_DIR/build/bin/server.js" \
  "$MCP_DIR/$SERVER_BINARY" \
  --shebang
echo "MCP server compiled: $MCP_DIR/$SERVER_BINARY"

echo ""
echo "=== Build VSCode extension (TypeScript) ==="
cd "$VSIX_DIR"
npm install
npm run compile
npm run package
echo "VSCode extension compiled and packaged"

echo ""
echo "=== Starting MCP server on port $PORT ==="
cleanup() { [ -n "${MCP_PID:-}" ] && kill "$MCP_PID" 2>/dev/null || true; }
trap cleanup EXIT

node "$MCP_DIR/$SERVER_BINARY" &
MCP_PID=$!

for i in $(seq 1 50); do
  if curl -sf "http://localhost:$PORT/admin/status" >/dev/null 2>&1; then
    echo "MCP server ready (PID: $MCP_PID, port: $PORT)"
    break
  fi
  if [ "$i" -eq 50 ]; then
    echo "MCP server failed to start"
    exit 1
  fi
  sleep 0.2
done

echo ""
echo "=== Ready ==="
echo "MCP endpoint:  http://localhost:$PORT/mcp"
echo "Admin status:  http://localhost:$PORT/admin/status"
echo "Admin events:  http://localhost:$PORT/admin/events"
echo "Press Ctrl+C to stop"
wait "$MCP_PID"
