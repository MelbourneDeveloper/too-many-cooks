/// Tests for notifications - NotificationEmitter.

import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createNotificationEmitter,
  EVENT_AGENT_REGISTERED,
  EVENT_LOCK_ACQUIRED,
  EVENT_AGENT_ACTIVATED,
  EVENT_AGENT_DEACTIVATED,
  EVENT_LOCK_RELEASED,
  EVENT_LOCK_RENEWED,
  EVENT_MESSAGE_SENT,
  EVENT_PLAN_UPDATED,
} from "../lib/src/notifications.js";

const createEmitter = () => {
  const server = new McpServer(
    { name: "test", version: "1.0.0" },
    {
      capabilities: {
        tools: { listChanged: false },
        logging: {},
      },
    },
  );
  return createNotificationEmitter(server);
};

describe("NotificationEmitter", () => {
  it("emit does nothing without throwing", () => {
    const emitter = createEmitter();
    // Should not throw
    emitter.emit(EVENT_AGENT_REGISTERED, { test: "data" });
  });

  it("emit with various event types does not throw", () => {
    const emitter = createEmitter();
    emitter.emit(EVENT_LOCK_ACQUIRED, { file: "/test.dart" });
    emitter.emit(EVENT_AGENT_ACTIVATED, { agent_name: "test" });
    emitter.emit(EVENT_AGENT_DEACTIVATED, { agent_name: "test" });
    emitter.emit(EVENT_PLAN_UPDATED, { plan: "test" });
  });
});

describe("Event constants", () => {
  it("event constants have correct values", () => {
    expect(EVENT_AGENT_REGISTERED).toBe("agent_registered");
    expect(EVENT_AGENT_ACTIVATED).toBe("agent_activated");
    expect(EVENT_AGENT_DEACTIVATED).toBe("agent_deactivated");
    expect(EVENT_LOCK_ACQUIRED).toBe("lock_acquired");
    expect(EVENT_LOCK_RELEASED).toBe("lock_released");
    expect(EVENT_LOCK_RENEWED).toBe("lock_renewed");
    expect(EVENT_MESSAGE_SENT).toBe("message_sent");
    expect(EVENT_PLAN_UPDATED).toBe("plan_updated");
  });
});
