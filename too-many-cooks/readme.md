<div align="center">

<img src="https://raw.githubusercontent.com/MelbourneDeveloper/too-many-cooks/main/website/src/assets/images/tmclogo.png" alt="Too Many Cooks" width="120">

# Too Many Cooks

**Multi-agent coordination MCP server**

[![npm](https://img.shields.io/npm/v/too-many-cooks?style=flat&color=c46d3b&label=npm)](https://www.npmjs.com/package/too-many-cooks)
[![License: MIT](https://img.shields.io/badge/license-MIT-3b9b8f)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-1a1a1a)](https://nodejs.org)

<br>

Multiple AI agents editing the same codebase?<br>
File locking, messaging, shared plans, and real-time push notifications.<br>
One server. No polling. No conflicts.

<br>

[Getting Started](https://toomanycooks.dev/docs/getting-started/) &#8226; [Documentation](https://toomanycooks.dev) &#8226; [VSCode Extension](#vscode-extension) &#8226; [npm](https://www.npmjs.com/package/too-many-cooks)

</div>

<br>

---

<br>

## Quick Start

```bash
npx too-many-cooks
```

Or install globally:

```bash
npm install -g too-many-cooks
too-many-cooks
```

The server starts on **port 4040** and exposes:

| Endpoint | Purpose |
|:---------|:--------|
| `http://localhost:4040/mcp` | MCP Streamable HTTP endpoint (for agents) |
| `http://localhost:4040/admin/*` | Admin REST + event stream (for the VSCode extension) |

### Environment Variables

| Variable | Default | Description |
|:---------|:--------|:------------|
| `TMC_PORT` | `4040` | Server port |
| `TMC_WORKSPACE` | `process.cwd()` | Target workspace folder |

```bash
TMC_PORT=5050 TMC_WORKSPACE=/path/to/project too-many-cooks
```

<br>

## Connect Your Agent

Too Many Cooks uses [**Streamable HTTP**](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) transport. All agents connect to the same running server so they see each other's locks, messages, and plans in real-time.

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

### Codex

```bash
codex --mcp-server \
  http://localhost:4040/mcp
```

</td>
</tr>
<tr>
<td>

### Cursor

Add to `.cursor/mcp.json`:

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

### Cline

Add via **Cline MCP Settings** in VSCode:

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
</table>

Any client that supports [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) can connect to `http://localhost:4040/mcp`.

<br>

## MCP Tools

<table>
<tr>
<td>

### `register`

Register a new agent or reconnect with an existing key. Returns a secret key on first call &mdash; **store it**.

| Input | Output |
|:------|:-------|
| `{ name: "my-agent" }` | `{ agent_name, agent_key }` |
| `{ key: "your-key" }` | Resumes existing session |

</td>
</tr>
<tr>
<td>

### `lock`

Advisory file locks to prevent conflicting edits.

| Action | Description |
|:-------|:------------|
| `acquire` | Lock a file for exclusive editing |
| `release` | Release your lock on a file |
| `force_release` | Release an expired lock held by another agent |
| `renew` | Extend your lock's expiry |
| `query` | Check if a specific file is locked |
| `list` | List all active locks |

</td>
</tr>
<tr>
<td>

### `message`

Inter-agent communication. Use `*` as `to_agent` to broadcast.

| Action | Description |
|:-------|:------------|
| `send` | Send a message to an agent or broadcast |
| `get` | Read messages (unread only by default) |
| `mark_read` | Mark a message as read |

</td>
</tr>
<tr>
<td>

### `plan`

Share what you're working on so other agents can coordinate.

| Action | Description |
|:-------|:------------|
| `update` | Set your goal and current task |
| `get` | View a specific agent's plan |
| `list` | View all agents' plans |

</td>
</tr>
<tr>
<td>

### `status`

System overview of all agents, locks, plans, and recent messages. No authentication required.

</td>
</tr>
</table>

<br>

## Real-Time Notifications

The server pushes events to all connected agents via Streamable HTTP. Agents receive notifications when:

- An agent registers or disconnects
- A file lock is acquired, released, or renewed
- A message is sent
- A plan is updated

No polling. The server pushes to every connected client in real-time.

<br>

## VSCode Extension

The companion [**Too Many Cooks VSCode extension**](https://github.com/MelbourneDeveloper/too-many-cooks) provides a live dashboard showing agents, file locks, messages, and plans. It connects to the same server on port 4040 automatically.

<br>

## Architecture

```
+-----------------+     +-----------------+     +-----------------+
|   Claude Code   |     |      Cline      |     |     Cursor      |
+--------+--------+     +--------+--------+     +--------+--------+
         |                       |                       |
         +--- Streamable HTTP ---+--- Streamable HTTP ---+
                                 |
                                 v
                  +--------------------------+
                  |   Too Many Cooks Server  |
                  |  http://localhost:4040    |
                  |                          |
                  |  /mcp    - agent endpoint|
                  |  /admin  - VSIX endpoint |
                  +------------+-------------+
                               |
                               v
                  +--------------------------+
                  |  .too_many_cooks/data.db  |
                  +--------------------------+
```

<br>

## Example CLAUDE.md Rules

```markdown
## Multi-Agent Coordination (Too Many Cooks)
- Register on TMC immediately. Keep your key! It's critical. Do not lose it!
- If disconnected, reconnect by calling register with ONLY your key
- Check messages regularly, lock files before editing, unlock after
- Don't edit locked files; signal intent via plans and messages
- Do not use Git unless asked by user
```

<br>

## License

MIT
