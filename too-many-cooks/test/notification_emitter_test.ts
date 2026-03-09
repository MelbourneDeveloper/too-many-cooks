/// Tests for NotificationEmitter with push callbacks and AgentEventHub.

import { describe, it } from "node:test";
import assert from "node:assert";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createNotificationEmitter,
  createAgentEventHub,
  sendNotification,
  BROADCAST_RECIPIENT,
  EVENT_AGENT_REGISTERED,
  EVENT_LOCK_ACQUIRED,
  EVENT_MESSAGE_SENT,
} from "../lib/src/notifications.js";

const createServer = () =>
  new McpServer(
    { name: "test", version: "1.0.0" },
    { capabilities: { tools: { listChanged: false }, logging: {} } },
  );

describe("NotificationEmitter with callbacks", () => {
  it("emit calls both adminPush and agentPush", () => {
    const adminEvents: string[] = [];
    const agentEvents: string[] = [];
    const adminPush = (event: string): void => { adminEvents.push(event); };
    const agentPush = (event: string): void => { agentEvents.push(event); };

    const emitter = createNotificationEmitter(createServer(), adminPush, agentPush);
    emitter.emit(EVENT_AGENT_REGISTERED, { agent_name: "test" });

    assert.strictEqual(adminEvents.length, 1);
    assert.strictEqual(adminEvents[0], EVENT_AGENT_REGISTERED);
    assert.strictEqual(agentEvents.length, 1);
    assert.strictEqual(agentEvents[0], EVENT_AGENT_REGISTERED);
  });

  it("emitAdmin calls only adminPush", () => {
    const adminEvents: string[] = [];
    const agentEvents: string[] = [];
    const adminPush = (event: string): void => { adminEvents.push(event); };
    const agentPush = (event: string): void => { agentEvents.push(event); };

    const emitter = createNotificationEmitter(createServer(), adminPush, agentPush);
    emitter.emitAdmin(EVENT_LOCK_ACQUIRED, { file: "/test.ts" });

    assert.strictEqual(adminEvents.length, 1);
    assert.strictEqual(agentEvents.length, 0);
  });

  it("emitToAgent calls adminPush and agentPushToAgent", () => {
    const adminEvents: string[] = [];
    const targetedEvents: Array<{ event: string; toAgent: string }> = [];
    const adminPush = (event: string): void => { adminEvents.push(event); };
    const agentPushToAgent = (event: string, _payload: Record<string, unknown>, toAgent: string): void => {
      targetedEvents.push({ event, toAgent });
    };

    const emitter = createNotificationEmitter(createServer(), adminPush, undefined, agentPushToAgent);
    emitter.emitToAgent(EVENT_MESSAGE_SENT, { content: "hello" }, "agent-2");

    assert.strictEqual(adminEvents.length, 1);
    assert.strictEqual(targetedEvents.length, 1);
    assert.strictEqual(targetedEvents[0].toAgent, "agent-2");
  });

  it("works with no callbacks (all undefined)", () => {
    const emitter = createNotificationEmitter(createServer());
    // Should not throw
    emitter.emit(EVENT_AGENT_REGISTERED, {});
    emitter.emitAdmin(EVENT_LOCK_ACQUIRED, {});
    emitter.emitToAgent(EVENT_MESSAGE_SENT, {}, "agent");
  });
});

describe("AgentEventHub", () => {
  it("creates with empty maps and sets", () => {
    const hub = createAgentEventHub();
    assert.strictEqual(hub.servers.size, 0);
    assert.strictEqual(hub.sessionAgentNames.size, 0);
    assert.strictEqual(hub.activeSseSessions.size, 0);
  });

  it("pushEvent does nothing with no servers", () => {
    const hub = createAgentEventHub();
    // Should not throw
    hub.pushEvent(EVENT_AGENT_REGISTERED, { agent_name: "test" });
  });

  it("pushToAgent does nothing with no servers", () => {
    const hub = createAgentEventHub();
    // Should not throw
    hub.pushToAgent(EVENT_MESSAGE_SENT, { content: "hello" }, "agent-1");
  });

  it("pushToAgent broadcast does nothing with no servers", () => {
    const hub = createAgentEventHub();
    // Should not throw
    hub.pushToAgent(EVENT_MESSAGE_SENT, { content: "hello" }, BROADCAST_RECIPIENT);
  });
});

describe("sendNotification", () => {
  it("returns error when server has no transport", async () => {
    const server = createServer();
    const result = await sendNotification(server, { test: "data" });
    // Should return error since server has no connected transport
    assert.strictEqual(result.ok, false);
  });
});
