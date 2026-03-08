# Too Many Cooks - VSCode Extension

VSCode extension for monitoring and managing multi-agent coordination. See the [spec](../docs/spec.md) for full documentation.

## How It Works

- Communicates with the TMC server via `/admin/*` REST endpoints
- Receives real-time state changes via [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) push (no polling)
- Does **not** access the database directly

## Features

- **Tree views** for agents, file locks, messages, and plans
- **Admin commands** via the command palette: delete agent, delete lock, reset key, send message
- **Real-time updates** as agents register, lock files, and communicate

## Build

```bash
bash scripts/vsix.sh build
```

## Install

```bash
bash scripts/vsix.sh install
```

## Test

```bash
npm test
```

## License

MIT
