# Too Many Cooks - VSCode Extension

Real-time dashboard for monitoring and managing multi-agent coordination. See which AI agents are active, what files are locked, and what messages are being exchanged — all from your editor.

## Requirements

The Too Many Cooks MCP server must be running. It uses [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) transport on port 4040.

### 1. Start the MCP server

```bash
npx too-many-cooks
```

Or install globally:

```bash
npm install -g too-many-cooks
too-many-cooks
```

The server starts on `http://localhost:4040/mcp`.

To use a different port, set the `TMC_PORT` environment variable:

```bash
TMC_PORT=5050 npx too-many-cooks
```

### 2. Connect your AI agents

Each agent connects to the MCP server via Streamable HTTP. Add the server to your agent's MCP configuration:

**Claude Code** (`.mcp.json` in your project root):

```json
{
  "mcpServers": {
    "too-many-cooks": {
      "type": "streamable-http",
      "url": "http://localhost:4040/mcp"
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "too-many-cooks": {
      "url": "http://localhost:4040/mcp"
    }
  }
}
```

**Cline** (MCP settings in VSCode):

Add a new MCP server with URL `http://localhost:4040/mcp` and transport type `streamable-http`.

### 3. Install the extension

Install from the `.vsix` file or the VSCode marketplace. The extension auto-connects to the server on port 4040 when it starts.

If the server runs on a non-default port, change it in VSCode settings:

- **Setting:** `tooManyCooks.port`
- **Default:** `4040`

Or add to `.vscode/settings.json`:

```json
{
  "tooManyCooks.port": 5050
}
```

## How it works

- Communicates with the TMC server via `/admin/*` REST endpoints
- Receives real-time state changes via MCP Streamable HTTP push (no polling)
- Does **not** access the database directly

## Features

- **Agents tree view** — see which agents are online and active
- **File Locks tree view** — see which files are locked and by whom
- **Messages panel** — read inter-agent messages in real-time
- **Plans panel** — see what each agent is working on
- **Admin commands** — force-release locks, delete agents, reset keys, send messages

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
