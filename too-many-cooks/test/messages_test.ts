/// Tests for inter-agent messaging.

import { describe, it, beforeEach, afterEach, expect } from "vitest";
import fs from "node:fs";
import {
  type TooManyCooksDb,
  createDataConfig,
  createDb,
  ERR_UNAUTHORIZED,
  ERR_VALIDATION,
  ERR_NOT_FOUND,
} from "../lib/src/data/data.js";

const TEST_DB_PATH = ".test_messages.db";

const deleteIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore
  }
};

describe("messages", () => {
  let db: TooManyCooksDb | undefined;
  let senderName = "";
  let senderKey = "";
  let receiverName = "";
  let receiverKey = "";

  beforeEach(() => {
    deleteIfExists(TEST_DB_PATH);
    const config = createDataConfig({ dbPath: TEST_DB_PATH });
    const result = createDb(config);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    db = result.value;

    // Register sender
    const senderReg = db.register("sender-agent");
    if (!senderReg.ok) throw new Error("expected ok");
    const sender = senderReg.value;
    senderName = sender.agentName;
    senderKey = sender.agentKey;

    // Register receiver
    const receiverReg = db.register("receiver-agent");
    if (!receiverReg.ok) throw new Error("expected ok");
    const receiver = receiverReg.value;
    receiverName = receiver.agentName;
    receiverKey = receiver.agentKey;
  });

  afterEach(() => {
    db?.close();
    deleteIfExists(TEST_DB_PATH);
  });

  it("sendMessage creates message with ID", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.sendMessage(
      senderName,
      senderKey,
      receiverName,
      "Hello!",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const messageId = result.value;
    expect(messageId).toHaveLength(16);
  });

  it("sendMessage fails with invalid credentials", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.sendMessage(
      senderName,
      "wrong-key",
      receiverName,
      "Hello!",
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_UNAUTHORIZED);
  });

  it("sendMessage fails for content exceeding max length", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const longContent = "x".repeat(201); // Default max is 200
    const result = db.sendMessage(
      senderName,
      senderKey,
      receiverName,
      longContent,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_VALIDATION);
    expect(result.error.message).toContain("200");
  });

  it("getMessages returns messages for agent", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.sendMessage(senderName, senderKey, receiverName, "Message 1");
    db.sendMessage(senderName, senderKey, receiverName, "Message 2");

    const result = db.getMessages(receiverName, receiverKey);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const messages = result.value;
    expect(messages).toHaveLength(2);
    expect(new Set(messages.map((m) => m.content))).toEqual(
      new Set(["Message 1", "Message 2"]),
    );
  });

  it("getMessages auto-marks messages as read", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.sendMessage(senderName, senderKey, receiverName, "Test message");

    // First fetch marks as read
    db.getMessages(receiverName, receiverKey);

    // Second fetch with unreadOnly=true should return empty
    const result = db.getMessages(receiverName, receiverKey, { unreadOnly: true });
    if (!result.ok) throw new Error("expected ok");
    const messages = result.value;
    expect(messages).toHaveLength(0);
  });

  it("getMessages with unreadOnly=false returns all messages", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.sendMessage(senderName, senderKey, receiverName, "Test message");

    // First fetch marks as read
    db.getMessages(receiverName, receiverKey);

    // Second fetch with unreadOnly=false should still return message
    const result = db.getMessages(
      receiverName,
      receiverKey,
      { unreadOnly: false },
    );
    if (!result.ok) throw new Error("expected ok");
    const messages = result.value;
    expect(messages).toHaveLength(1);
  });

  it("getMessages fails with invalid credentials", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.getMessages(receiverName, "wrong-key");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_UNAUTHORIZED);
  });

  it("markRead marks specific message", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const sendResult = db.sendMessage(
      senderName,
      senderKey,
      receiverName,
      "To be read",
    );
    if (!sendResult.ok) throw new Error("expected ok");
    const messageId = sendResult.value;

    const result = db.markRead(messageId, receiverName, receiverKey);
    expect(result.ok).toBe(true);
  });

  it("markRead fails for nonexistent message", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.markRead("nonexistent-id", receiverName, receiverKey);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_NOT_FOUND);
  });

  it("broadcast message reaches all agents", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    // Send broadcast (to_agent = '*' is broadcast)
    db.sendMessage(senderName, senderKey, "*", "Announcement!");

    // Receiver should get broadcast messages
    const result = db.getMessages(receiverName, receiverKey);
    if (!result.ok) throw new Error("expected ok");
    const messages = result.value;
    expect(messages.some((m) => m.content === "Announcement!")).toBe(true);
  });

  it("listAllMessages returns all messages", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.sendMessage(senderName, senderKey, receiverName, "Direct message");
    db.sendMessage(senderName, senderKey, "*", "Broadcast");

    const result = db.listAllMessages();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const messages = result.value;
    expect(messages).toHaveLength(2);
  });

  it("message contains correct metadata", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.sendMessage(senderName, senderKey, receiverName, "Test");

    const result = db.getMessages(receiverName, receiverKey);
    if (!result.ok) throw new Error("expected ok");
    const messages = result.value;
    const msg = messages[0]!;

    expect(msg.fromAgent).toBe(senderName);
    expect(msg.toAgent).toBe(receiverName);
    expect(msg.content).toBe("Test");
    expect(msg.createdAt).toBeGreaterThan(0);
    expect(msg.id).toHaveLength(16);
  });
});
