/// Tests for agent registration.

import { describe, it, beforeEach, afterEach, expect } from "vitest";
import fs from "node:fs";
import {
  type TooManyCooksDb,
  createDb,
  createDataConfig,
  ERR_VALIDATION,
} from "../lib/src/data/data.js";

const TEST_DB_PATH = ".test_registration.db";

const deleteIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore
  }
};

describe("registration", () => {
  let db: TooManyCooksDb | undefined;

  beforeEach(() => {
    deleteIfExists(TEST_DB_PATH);
    const config = createDataConfig({ dbPath: TEST_DB_PATH });
    const result = createDb(config);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    db = result.value;
  });

  afterEach(() => {
    db?.close();
    deleteIfExists(TEST_DB_PATH);
  });

  it("register creates agent with key", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.register("test-agent");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const reg = result.value;
    expect(reg.agentName).toBe("test-agent");
    expect(reg.agentKey).toHaveLength(64);
  });

  it("register fails for duplicate name", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.register("duplicate-agent");
    const result = db.register("duplicate-agent");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_VALIDATION);
    expect(result.error.message).toContain("already registered");
  });

  it("register fails for empty name", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.register("");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_VALIDATION);
    expect(result.error.message).toContain("1-50");
  });

  it("register fails for name over 50 chars", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.register("a".repeat(51));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_VALIDATION);
    expect(result.error.message).toContain("1-50");
  });

  it("register accepts name of exactly 50 chars", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.register("a".repeat(50));
    expect(result.ok).toBe(true);
  });

  it("listAgents returns registered agents", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.register("agent1");
    db.register("agent2");
    const result = db.listAgents();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const agents = result.value;
    expect(agents).toHaveLength(2);
    expect(new Set(agents.map((a) => a.agentName))).toEqual(
      new Set(["agent1", "agent2"]),
    );
  });
});
