/// Tests for pure types.

import { describe, it, expect } from "vitest";
import {
  defaultConfig,
  createDataConfig,
  createDataConfigFromWorkspace,
  getWorkspaceFolder,
  resolveDbPath,
} from "../lib/src/config.js";
import * as data from "../lib/src/data/data.js";
import {
  textContent,
  ERR_NOT_FOUND,
  ERR_UNAUTHORIZED,
  ERR_LOCK_HELD,
  ERR_LOCK_EXPIRED,
  ERR_VALIDATION,
  ERR_DATABASE,
} from "../lib/src/types.js";

describe("TooManyCooksConfig", () => {
  it("defaultConfig has correct values", () => {
    // dbPath is dynamic based on HOME env var, just check it ends correctly
    expect(defaultConfig.dbPath).toContain(".too_many_cooks/data.db");
    expect(defaultConfig.lockTimeoutMs).toBe(600000);
    expect(defaultConfig.maxMessageLength).toBe(200);
    expect(defaultConfig.maxPlanLength).toBe(100);
  });

  it("custom config works", () => {
    const config = {
      dbPath: "custom.db",
      lockTimeoutMs: 1000,
      maxMessageLength: 500,
      maxPlanLength: 200,
    };
    expect(config.dbPath).toBe("custom.db");
    expect(config.lockTimeoutMs).toBe(1000);
  });

  it("defaultConfig matches data layer defaultConfig", () => {
    expect(defaultConfig.dbPath).toBe(data.defaultConfig.dbPath);
    expect(defaultConfig.lockTimeoutMs).toBe(data.defaultConfig.lockTimeoutMs);
    expect(defaultConfig.maxMessageLength).toBe(
      data.defaultConfig.maxMessageLength,
    );
    expect(defaultConfig.maxPlanLength).toBe(data.defaultConfig.maxPlanLength);
  });

  it("re-exported getWorkspaceFolder matches data package", () => {
    expect(getWorkspaceFolder()).toBe(data.getWorkspaceFolder());
  });

  it("re-exported resolveDbPath matches data package", () => {
    expect(resolveDbPath("/test")).toBe(data.resolveDbPath("/test"));
  });

  it("re-exported createDataConfigFromWorkspace matches data package", () => {
    const local = createDataConfigFromWorkspace("/test");
    const fromData = data.createDataConfigFromWorkspace("/test");
    expect(local.dbPath).toBe(fromData.dbPath);
  });

  it("TooManyCooksConfig is identical to TooManyCooksDataConfig", () => {
    const config = createDataConfig({ dbPath: "/test.db" });
    const dataConfig = data.createDataConfig({ dbPath: "/test.db" });
    expect(config.dbPath).toBe(dataConfig.dbPath);
  });
});

describe("Types", () => {
  it("AgentIdentity can be created", () => {
    const identity = {
      agentName: "test-agent",
      registeredAt: 1234567890,
      lastActive: 1234567899,
    };
    expect(identity.agentName).toBe("test-agent");
    expect(identity.registeredAt).toBe(1234567890);
    expect(identity.lastActive).toBe(1234567899);
  });

  it("AgentRegistration can be created", () => {
    const reg = { agentName: "agent1", agentKey: "secret-key-123" };
    expect(reg.agentName).toBe("agent1");
    expect(reg.agentKey).toBe("secret-key-123");
  });

  it("FileLock can be created", () => {
    const lock = {
      filePath: "/src/main.dart",
      agentName: "agent1",
      acquiredAt: 1000,
      expiresAt: 2000,
      reason: "editing",
      version: 1,
    };
    expect(lock.filePath).toBe("/src/main.dart");
    expect(lock.agentName).toBe("agent1");
    expect(lock.reason).toBe("editing");
    expect(lock.version).toBe(1);
  });

  it("FileLock reason can be null", () => {
    const lock = {
      filePath: "/src/main.dart",
      agentName: "agent1",
      acquiredAt: 1000,
      expiresAt: 2000,
      reason: undefined,
      version: 1,
    };
    expect(lock.reason).toBeUndefined();
  });

  it("LockResult acquired true", () => {
    const result = {
      acquired: true,
      lock: {
        filePath: "/test.dart",
        agentName: "agent1",
        acquiredAt: 1000,
        expiresAt: 2000,
        reason: undefined,
        version: 1,
      },
      error: undefined,
    };
    expect(result.acquired).toBe(true);
    expect(result.lock).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it("LockResult acquired false with error", () => {
    const result = {
      acquired: false,
      lock: undefined,
      error: "Lock held by another agent",
    };
    expect(result.acquired).toBe(false);
    expect(result.lock).toBeUndefined();
    expect(result.error).toBe("Lock held by another agent");
  });

  it("Message can be created", () => {
    const msg = {
      id: "msg-123",
      fromAgent: "agent1",
      toAgent: "agent2",
      content: "Hello!",
      createdAt: 1000,
      readAt: undefined,
    };
    expect(msg.id).toBe("msg-123");
    expect(msg.fromAgent).toBe("agent1");
    expect(msg.toAgent).toBe("agent2");
    expect(msg.content).toBe("Hello!");
    expect(msg.readAt).toBeUndefined();
  });

  it("Message with readAt", () => {
    const msg = {
      id: "msg-123",
      fromAgent: "agent1",
      toAgent: "agent2",
      content: "Hello!",
      createdAt: 1000,
      readAt: 2000,
    };
    expect(msg.readAt).toBe(2000);
  });

  it("AgentPlan can be created", () => {
    const plan = {
      agentName: "agent1",
      goal: "Fix all bugs",
      currentTask: "Reviewing code",
      updatedAt: 1000,
    };
    expect(plan.agentName).toBe("agent1");
    expect(plan.goal).toBe("Fix all bugs");
    expect(plan.currentTask).toBe("Reviewing code");
  });

  it("DbError can be created", () => {
    const error = { code: ERR_NOT_FOUND, message: "Agent not found" };
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Agent not found");
  });
});

describe("Error codes", () => {
  it("errNotFound is correct", () => {
    expect(ERR_NOT_FOUND).toBe("NOT_FOUND");
  });

  it("errUnauthorized is correct", () => {
    expect(ERR_UNAUTHORIZED).toBe("UNAUTHORIZED");
  });

  it("errLockHeld is correct", () => {
    expect(ERR_LOCK_HELD).toBe("LOCK_HELD");
  });

  it("errLockExpired is correct", () => {
    expect(ERR_LOCK_EXPIRED).toBe("LOCK_EXPIRED");
  });

  it("errValidation is correct", () => {
    expect(ERR_VALIDATION).toBe("VALIDATION");
  });

  it("errDatabase is correct", () => {
    expect(ERR_DATABASE).toBe("DATABASE");
  });
});

describe("textContent", () => {
  it("creates text content map", () => {
    const content = textContent("Hello world");
    expect(content.type).toBe("text");
    expect(content.text).toBe("Hello world");
  });

  it("handles empty string", () => {
    const content = textContent("");
    expect(content.type).toBe("text");
    expect(content.text).toBe("");
  });

  it("handles special characters", () => {
    const content = textContent('{"json": "value"}');
    expect(content.text).toBe('{"json": "value"}');
  });
});
