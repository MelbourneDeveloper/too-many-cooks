# Agent Stop-Condition Problem

## The Problem

When a coordinator confirms that all tasks are complete, worker agents fail to stop. Instead, they enter an infinite polling loop calling `message get` until interrupted by the user.

This happened in production: a coordinator sent "ALL FIXES VERIFIED" to a worker agent. The worker received the message, marked it read, acknowledged it --- and then polled for new messages in a tight loop for 15 minutes until the user manually interrupted.

The root cause is that TMC messages are unstructured free text. The agent must **parse natural language** to determine whether a message means "keep working", "wait for more", or "you're done". When the agent gets this wrong, there is no fallback --- it loops forever.

## Why Free-Text Messages Fail

TMC messages have one field for content: a 200-character plain text string. Every message looks the same to the agent regardless of intent:

```json
{"from_agent": "Coordinator", "content": "ALL FIXES VERIFIED. Stand by."}
{"from_agent": "Coordinator", "content": "Fix the bug in parser.rs"}
{"from_agent": "Coordinator", "content": "STATUS CHECK. Report back."}
```

The agent must infer:
- Is this a new task? (keep working)
- Is this a confirmation? (check if my stop condition is met)
- Is this a dismissal? (stop completely)

This is unreliable. Agents are bad at mapping free-text coordinator messages back to their original stop conditions, especially when the message contains mixed signals (e.g. "ALL FIXES VERIFIED" + "Stand by" in the same message).

## Recommendations

### 1. Add a `type` field to messages

Add an optional `type` field to the message tool's `send` action. Suggested values:

| Type | Meaning | Agent should... |
|------|---------|-----------------|
| `task` | New work assignment | Start working |
| `status_check` | Coordinator wants a progress report | Reply with current status |
| `confirmation` | Coordinator confirms work is done | Check stop condition |
| `dismiss` | Agent is released from duty | **Stop immediately** |
| `info` | FYI, no action needed | Note it and continue |

Default to `info` if omitted, for backward compatibility.

**Schema change:**
```typescript
// message send action
{
  action: "send",
  to_agent: "worker",
  content: "ALL FIXES VERIFIED",
  type: "dismiss"  // new optional field
}
```

**Agent-side logic becomes trivial:**
```
if message.type == "dismiss" -> stop polling, report to user
if message.type == "task" -> start working on content
if message.type == "confirmation" -> evaluate stop condition
```

This eliminates natural language parsing entirely for control flow decisions.

### 2. Add a `dismiss` tool

A dedicated tool that formally releases an agent:

```typescript
// coordinator calls:
mcp__too-many-cooks__dismiss({ agent: "claude-opus" })

// worker receives a push notification:
{ event: "agent_dismissed", payload: { agent_name: "claude-opus" } }
```

When an agent receives a dismiss event, it **must stop**. No ambiguity. No parsing. The coordinator pressed the "done" button.

This is better than a message type because:
- It's a distinct tool call, not a field on an existing tool
- It can update the agent's state server-side (e.g. mark as "dismissed" in the DB)
- The push notification system already supports custom events
- Other agents can see who has been dismissed via `status`

### 3. Add agent states to the plan system

Currently, plans have `goal` and `current_task`. Add a `state` field:

| State | Meaning |
|-------|---------|
| `idle` | Registered but no work assigned |
| `working` | Actively executing a task |
| `blocked` | Waiting on another agent or resource |
| `done` | Work complete, awaiting dismissal |
| `dismissed` | Released by coordinator |

The coordinator transitions agent state explicitly:
```typescript
mcp__too-many-cooks__plan({
  action: "update",
  state: "dismissed"  // new field
})
```

Agents check their own state and act accordingly. An agent in `dismissed` state stops all activity.

### 4. Convention: prefix messages with intent tags (no code changes)

If the above features take time to implement, adopt a **message prefix convention** immediately:

```
[TASK] Fix the bug in parser.rs
[CONFIRM] ALL FIXES VERIFIED
[DISMISS] You're done. Stop.
[STATUS?] Report your progress
[INFO] I also fixed the config file
```

This is fragile (agents can still ignore it) but costs nothing to adopt and makes intent explicit in the 200-char message. Document it in the TMC skill prompt so agents know to look for it.

## Priority

**Recommendation 1 (message types)** is the highest-value, lowest-effort change. It's a single optional field on an existing tool. It solves the problem directly without new tools or schema migrations.

**Recommendation 4 (prefix convention)** is free and can be adopted today while the others are built.

## Impact

Without this fix, every TMC session risks an agent burning tokens in an infinite poll loop after work is confirmed complete. The user must manually interrupt, which defeats the purpose of multi-agent coordination.
