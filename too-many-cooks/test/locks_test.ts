/// Tests for file lock operations.

import { describe, it, beforeEach, afterEach } from "vitest";
import { expect } from "vitest";
import fs from "node:fs";
import {
  type TooManyCooksDb,
  createDataConfig,
  createDb,
  ERR_UNAUTHORIZED,
  ERR_NOT_FOUND,
  ERR_LOCK_HELD,
} from "../lib/src/data/data.js";

const TEST_DB_PATH = ".test_locks.db";

const deleteIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore
  }
};

describe("locks", () => {
  let db: TooManyCooksDb | undefined;
  let agentName = "";
  let agentKey = "";

  beforeEach(() => {
    deleteIfExists(TEST_DB_PATH);
    const config = createDataConfig({ dbPath: TEST_DB_PATH });
    const result = createDb(config);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    db = result.value;

    // Register a test agent
    const regResult = db.register("lock-agent");
    if (!regResult.ok) throw new Error("expected ok");
    const reg = regResult.value;
    agentName = reg.agentName;
    agentKey = reg.agentKey;
  });

  afterEach(() => {
    db?.close();
    deleteIfExists(TEST_DB_PATH);
  });

  it("acquireLock succeeds on free file", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.acquireLock(
      "/path/to/file.dart",
      agentName,
      agentKey,
      "editing",
      60000,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const lockResult = result.value;
    expect(lockResult.acquired).toBe(true);
    expect(lockResult.lock).toBeDefined();
    expect(lockResult.lock!.filePath).toBe("/path/to/file.dart");
    expect(lockResult.lock!.agentName).toBe(agentName);
    expect(lockResult.lock!.reason).toBe("editing");
    expect(lockResult.error).toBeUndefined();
  });

  it("acquireLock fails when held by another agent", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    // Register second agent
    const reg2Result = db.register("lock-agent-2");
    if (!reg2Result.ok) throw new Error("expected ok");
    const reg2 = reg2Result.value;

    // First agent acquires lock
    db.acquireLock("/contested/file.dart", agentName, agentKey, undefined, 60000);

    // Second agent tries to acquire
    const result = db.acquireLock(
      "/contested/file.dart",
      reg2.agentName,
      reg2.agentKey,
      undefined,
      60000,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const lockResult = result.value;
    expect(lockResult.acquired).toBe(false);
    expect(lockResult.lock).toBeUndefined();
    expect(lockResult.error).toContain("Held by");
  });

  it("acquireLock fails with invalid credentials", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.acquireLock(
      "/path/to/file.dart",
      agentName,
      "wrong-key",
      undefined,
      60000,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_UNAUTHORIZED);
  });

  it("releaseLock succeeds when owned", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.acquireLock("/release/file.dart", agentName, agentKey, undefined, 60000);

    const result = db.releaseLock("/release/file.dart", agentName, agentKey);
    expect(result.ok).toBe(true);

    // Verify lock is gone
    const queryResult = db.queryLock("/release/file.dart");
    expect(queryResult.ok).toBe(true);
    if (!queryResult.ok) throw new Error("expected ok");
    const lock = queryResult.value;
    expect(lock).toBeUndefined();
  });

  it("releaseLock fails when not owned", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.releaseLock("/not/locked.dart", agentName, agentKey);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_NOT_FOUND);
  });

  it("queryLock returns lock info", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.acquireLock("/query/file.dart", agentName, agentKey, "testing", 60000);

    const result = db.queryLock("/query/file.dart");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const lock = result.value;
    expect(lock).toBeDefined();
    expect(lock!.filePath).toBe("/query/file.dart");
    expect(lock!.agentName).toBe(agentName);
    expect(lock!.reason).toBe("testing");
  });

  it("queryLock returns null for unlocked file", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.queryLock("/not/locked.dart");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const lock = result.value;
    expect(lock).toBeUndefined();
  });

  it("listLocks returns all active locks", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.acquireLock("/list/file1.dart", agentName, agentKey, undefined, 60000);
    db.acquireLock("/list/file2.dart", agentName, agentKey, undefined, 60000);

    const result = db.listLocks();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const locks = result.value;
    expect(locks).toHaveLength(2);
    expect(new Set(locks.map((l) => l.filePath))).toEqual(
      new Set(["/list/file1.dart", "/list/file2.dart"]),
    );
  });

  it("renewLock extends expiration", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    db.acquireLock("/renew/file.dart", agentName, agentKey, undefined, 1000);

    const queryBefore = db.queryLock("/renew/file.dart");
    expect(queryBefore.ok).toBe(true);
    if (!queryBefore.ok) throw new Error("expected ok");
    const lockBefore = queryBefore.value!;

    const result = db.renewLock(
      "/renew/file.dart",
      agentName,
      agentKey,
      60000,
    );
    expect(result.ok).toBe(true);

    const queryAfter = db.queryLock("/renew/file.dart");
    expect(queryAfter.ok).toBe(true);
    if (!queryAfter.ok) throw new Error("expected ok");
    const lockAfter = queryAfter.value!;
    expect(lockAfter.expiresAt).toBeGreaterThan(lockBefore.expiresAt);
    expect(lockAfter.version).toBeGreaterThan(lockBefore.version);
  });

  it("renewLock fails when not owned", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.renewLock("/not/owned.dart", agentName, agentKey, 60000);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_NOT_FOUND);
  });

  it("acquireLock takes over expired lock", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    // Acquire with 0ms timeout (immediately expired)
    db.acquireLock("/expire/file.dart", agentName, agentKey, undefined, 0);

    // Register second agent
    const reg2Result = db.register("lock-agent-3");
    if (!reg2Result.ok) throw new Error("expected ok");
    const reg2 = reg2Result.value;

    // Second agent should acquire expired lock (expiry checked at acquire time)
    const result = db.acquireLock(
      "/expire/file.dart",
      reg2.agentName,
      reg2.agentKey,
      undefined,
      60000,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    const lockResult = result.value;
    expect(lockResult.acquired).toBe(true);
    expect(lockResult.lock!.agentName).toBe(reg2.agentName);
  });

  it("forceReleaseLock fails on non-expired lock", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    // Register second agent
    const reg2Result = db.register("force-agent");
    if (!reg2Result.ok) throw new Error("expected ok");
    const reg2 = reg2Result.value;

    // First agent acquires with long timeout
    db.acquireLock("/force/file.dart", agentName, agentKey, undefined, 600000);

    // Second agent tries to force release
    const result = db.forceReleaseLock(
      "/force/file.dart",
      reg2.agentName,
      reg2.agentKey,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_LOCK_HELD);
  });

  it("forceReleaseLock fails when no lock exists", () => {
    expect(db).toBeDefined();
    if (!db) throw new Error("expected db");
    const result = db.forceReleaseLock("/no/lock.dart", agentName, agentKey);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error");
    expect(result.error.code).toBe(ERR_NOT_FOUND);
  });
});
