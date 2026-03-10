<div align="center">

<img src="https://raw.githubusercontent.com/MelbourneDeveloper/too-many-cooks/main/website/src/assets/images/tmclogo.png" alt="Too Many Cooks" width="120">

# Too Many Cooks — VSCode Extension

**Real-time dashboard for multi-agent coordination**

[![Version](https://img.shields.io/badge/version-0.4.0-c46d3b)](https://github.com/MelbourneDeveloper/too-many-cooks)
[![License: MIT](https://img.shields.io/badge/license-MIT-3b9b8f)](LICENSE)
[![VSCode](https://img.shields.io/badge/vscode-%3E%3D1.85-1a1a1a)](https://code.visualstudio.com)

<br>

See which AI agents are active, what files are locked,<br>
and what messages are being exchanged — all from your editor.

<br>

[Install the MCP Server](#requirements) &#8226; [Features](#features) &#8226; [Build](#build) &#8226; [Documentation](https://toomanycooks.dev)

</div>

<br>

---

<br>

## Requirements

The [**Too Many Cooks MCP server**](https://www.npmjs.com/package/too-many-cooks) must be running. Install and start it:

```bash
npx too-many-cooks
```

Or install globally:

```bash
npm install -g too-many-cooks
too-many-cooks
```

The server starts on `http://localhost:4040`. To use a different port:

```bash
TMC_PORT=5050 npx too-many-cooks
```

Then connect your AI agents to the server:

<table>
<tr>
<td width="50%">

### Claude Code

```bash
claude mcp add \
  --transport http \
  too-many-cooks \
  http://localhost:4040/mcp
```

</td>
<td width="50%">

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "too-many-cooks": {
      "url": "http://localhost:4040/mcp"
    }
  }
}
```

</td>
</tr>
<tr>
<td>

### Cline

Add via **Cline MCP Settings**:

```json
{
  "mcpServers": {
    "too-many-cooks": {
      "url": "http://localhost:4040/mcp"
    }
  }
}
```

</td>
<td>

### Codex

```bash
codex --mcp-server \
  http://localhost:4040/mcp
```

</td>
</tr>
</table>

<br>

## Install the Extension

Install from a `.vsix` file or the VSCode marketplace. The extension auto-connects to the server on port 4040.

If the server runs on a non-default port, set it in VSCode settings:

| Setting | Default | Description |
|:--------|:--------|:------------|
| `tooManyCooks.port` | `4040` | MCP server port |

```json
{
  "tooManyCooks.port": 5050
}
```

<br>

## Features

<table>
<tr>
<td width="50%">

### Agents Tree View
See which agents are online and active in the sidebar.

### File Locks Tree View
See which files are locked and by whom. Expired locks are highlighted.

### Messages Panel
Read inter-agent messages in real-time as they arrive.

</td>
<td width="50%">

### Plans Panel
See what each agent is working on, their goals and current tasks.

### Admin Commands
Force-release locks, delete agents, reset keys, and send messages from the command palette.

### Real-Time Updates
State changes arrive via MCP Streamable HTTP push. No polling.

</td>
</tr>
</table>

<br>

## How It Works

- Communicates with the TMC server via `/admin/*` REST endpoints
- Receives real-time state changes via MCP Streamable HTTP push (no polling)
- Does **not** access the database directly

<br>

## Build

```bash
bash scripts/vsix.sh build
```

## Install from Source

```bash
bash scripts/vsix.sh install
```

## Test

```bash
npm test
```

## Test Coverage (Pure Logic)

```bash
npm run test:coverage
```

<br>

## License

MIT
