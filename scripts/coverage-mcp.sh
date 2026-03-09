#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCP_DIR="$ROOT/too-many-cooks"

DART_NODE="$(cd "$ROOT/../dart_node" && pwd)"
COV_PKG="$DART_NODE/packages/dart_node_coverage"

cd "$MCP_DIR"
rm -rf coverage
mkdir -p coverage
dart run "$COV_PKG/bin/coverage.dart" . -o coverage/lcov.info
echo ""
echo "LCOV: $MCP_DIR/coverage/lcov.info"
