# Too Many Cooks

Multi-agent coordination MCP server. Enables multiple AI agents to safely edit a codebase simultaneously with file locking, messaging, and shared plans.

Built with Dart, compiled to Node.js. Uses [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) transport so all agents connect to one shared server and receive real-time push notifications. Made with [dart_node](https://www.dartnode.org).

## Install

```bash
npm install -g too-many-cooks
```

## Quick Start

Start the server:

```bash
too-many-cooks
```

The server listens on `http://localhost:4040` by default. The MCP endpoint is at `/mcp`.

Set `TMC_WORKSPACE` to target a specific workspace folder (defaults to `process.cwd()`).

## Client Configuration

Too Many Cooks uses **Streamable HTTP** transport. All agents connect to the same running server over HTTP so they can see each other's state and receive real-time notifications. This is different from stdio-based MCP servers where each agent gets an isolated process.

### Claude Code

```bash
claude mcp add --transport http too-many-cooks http://localhost:4040/mcp
```

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

### Cline

Add to Cline MCP settings:

```json
{
  "mcpServers": {
    "too-many-cooks": {
      "url": "http://localhost:4040/mcp"
    }
  }
}
```

### Codex

```bash
codex --mcp-server http://localhost:4040/mcp
```

### Generic MCP Client

Any MCP client that supports Streamable HTTP can connect:

```
URL: http://localhost:4040/mcp
Transport: Streamable HTTP
```

## MCP Tools

### `register`

Register a new agent or reconnect. Returns a secret key on first call - store it!

- **New agent**: `{ name: "my-agent" }` - returns `{ agent_name, agent_key }`
- **Reconnect**: `{ key: "your-stored-key" }` - resumes session

### `lock`

Advisory file locks to prevent conflicting edits.

| Action | Description |
|--------|-------------|
| `acquire` | Lock a file for exclusive editing |
| `release` | Release your lock on a file |
| `force_release` | Release an expired lock held by another agent |
| `renew` | Extend your lock's expiry |
| `query` | Check if a specific file is locked |
| `list` | List all active locks |

### `message`

Inter-agent communication. Use `*` as `to_agent` to broadcast.

| Action | Description |
|--------|-------------|
| `send` | Send a message to an agent or broadcast |
| `get` | Read messages (unread only by default) |
| `mark_read` | Mark a message as read |

### `plan`

Share what you're working on so other agents can see.

| Action | Description |
|--------|-------------|
| `update` | Set your goal and current task |
| `get` | View a specific agent's plan |
| `list` | View all agents' plans |

### `status`

System overview of all agents, locks, plans, and recent messages. No authentication required.

## Real-Time Notifications

The server pushes events to all connected agents via MCP Streamable HTTP. Agents receive notifications in real-time when:

- An agent registers or disconnects
- A file lock is acquired, released, or renewed
- A message is sent
- A plan is updated

No polling required. The server pushes state changes to every connected client automatically.

## Example CLAUDE.md Rules

```markdown
## Multi-Agent Coordination (Too Many Cooks)
- Register on TMC immediately. Keep your key! It's critical. Do not lose it!
- If disconnected, reconnect by calling register with ONLY your key
- Check messages regularly, lock files before editing, unlock after
- Don't edit locked files; signal intent via plans and messages
- Do not use Git unless asked by user
```

## Architecture

Single HTTP server per workspace. All agents connect over HTTP to the same process, enabling real-time coordination.

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
                  +------------+-------------+
                               |
                               v
                  +--------------------------+
                  |  .too_many_cooks/data.db  |
                  +--------------------------+
```

## License

MIT
