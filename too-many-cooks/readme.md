# Too Many Cooks - MCP Server

Multi-agent coordination MCP server built with Dart, compiled to Node.js via dart2js. See the [spec](../docs/spec.md) for the full protocol specification.

## Install

```bash
npm install -g too-many-cooks
```

**Claude Code:**
```bash
claude mcp add --transport stdio too-many-cooks -- too-many-cooks
```

**Cline:**
```bash
bash scripts/mcp.sh install-cline
```

Set `TMC_WORKSPACE` to target a specific workspace folder (defaults to `process.cwd()`).

## Build

```bash
bash scripts/mcp.sh build
```

## Test

```bash
bash scripts/test-mcp.sh
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `register` | Register an agent and receive an API key |
| `acquire_lock` | Lock a file for exclusive editing |
| `release_lock` | Release a file lock |
| `list_locks` | List all active file locks |
| `send_message` | Send a message to another agent or broadcast |
| `read_messages` | Read messages addressed to the calling agent |
| `update_plan` | Publish or update the agent's current plan |
| `list_plans` | View all agents' published plans |

## Example CLAUDE.md Rules

```markdown
## Multi-Agent Coordination (Too Many Cooks)
- Keep your key! If disconnected, reconnect by calling register with ONLY your key
- Check messages regularly, lock files before editing, unlock after
- Don't edit locked files; signal intent via plans and messages
- Do not use Git unless asked by user
```

## License

MIT
