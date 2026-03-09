/// Tests for admin operations (no auth required).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

import {
  type TooManyCooksDb,
  type AgentRegistration,
  type AgentIdentity,
  createDataConfig,
  createDb,
  ERR_NOT_FOUND,
  ERR_UNAUTHORIZED,
} from '../lib/src/data/data.js';

const TEST_DB_PATH = '.test_admin.db' as const;

const deleteIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore
  }
};

describe('admin_test', () => {
  let db: TooManyCooksDb | undefined;

  beforeEach(() => {
    deleteIfExists(TEST_DB_PATH);
    const config = createDataConfig({ dbPath: TEST_DB_PATH });
    const result = createDb(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      db = result.value;
    }
  });

  afterEach(() => {
    db?.close();
    deleteIfExists(TEST_DB_PATH);
  });

  it('adminDeleteLock removes lock', () => {
    // Register agent and acquire lock
    const regResult = db!.register('admin-test-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;
    db!.acquireLock(
      '/admin/file.dart',
      reg.agentName,
      reg.agentKey,
      null,
      60000,
    );

    // Admin deletes lock (no auth required)
    const result = db!.adminDeleteLock('/admin/file.dart');
    expect(result.ok).toBe(true);

    // Verify lock is gone
    const query = db!.queryLock('/admin/file.dart');
    if (query.ok) {
      expect(query.value).toBeNull();
    }
  });

  it('adminDeleteLock fails for nonexistent lock', () => {
    const result = db!.adminDeleteLock('/no/such/lock.dart');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERR_NOT_FOUND);
    }
  });

  it('adminDeleteAgent removes agent and all related data', () => {
    // Register agent
    const regResult = db!.register('delete-me-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;

    // Create agent data: lock, plan, message
    db!.acquireLock(
      '/delete/file.dart',
      reg.agentName,
      reg.agentKey,
      null,
      60000,
    );
    db!.updatePlan(reg.agentName, reg.agentKey, 'Goal', 'Task');

    // Register another agent to send message
    const reg2Result = db!.register('other-agent');
    expect(reg2Result.ok).toBe(true);
    if (!reg2Result.ok) return;
    const reg2 = reg2Result.value as AgentRegistration;
    db!.sendMessage(reg.agentName, reg.agentKey, reg2.agentName, 'Hello');

    // Admin deletes agent
    const result = db!.adminDeleteAgent(reg.agentName);
    expect(result.ok).toBe(true);

    // Verify agent is gone
    const agents = db!.listAgents();
    if (agents.ok) {
      const agentNames = agents.value.map((a: AgentIdentity) => a.agentName);
      expect(agentNames).not.toContain('delete-me-agent');
    }

    // Verify lock is gone
    const lock = db!.queryLock('/delete/file.dart');
    if (lock.ok) {
      expect(lock.value).toBeNull();
    }

    // Verify plan is gone
    const plan = db!.getPlan(reg.agentName);
    if (plan.ok) {
      expect(plan.value).toBeNull();
    }
  });

  it('adminDeleteAgent fails for nonexistent agent', () => {
    const result = db!.adminDeleteAgent('nonexistent-agent');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERR_NOT_FOUND);
    }
  });

  it('adminResetKey generates new key', () => {
    // Register agent
    const regResult = db!.register('reset-key-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;
    const oldKey = reg.agentKey;

    // Reset key
    const result = db!.adminResetKey(reg.agentName);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const newReg = result.value as AgentRegistration;

    expect(newReg.agentName).toBe(reg.agentName);
    expect(newReg.agentKey).not.toBe(oldKey);
    expect(newReg.agentKey.length).toBe(64);
  });

  it('adminResetKey invalidates old key', () => {
    // Register agent
    const regResult = db!.register('invalidate-key-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;
    const oldKey = reg.agentKey;

    // Reset key
    db!.adminResetKey(reg.agentName);

    // Old key should no longer work
    const authResult = db!.authenticate(reg.agentName, oldKey);
    expect(authResult.ok).toBe(false);
    if (!authResult.ok) {
      expect(authResult.error.code).toBe(ERR_UNAUTHORIZED);
    }
  });

  it('adminResetKey releases locks held by agent', () => {
    // Register agent and acquire lock
    const regResult = db!.register('lock-reset-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;
    db!.acquireLock(
      '/reset/file.dart',
      reg.agentName,
      reg.agentKey,
      null,
      60000,
    );

    // Reset key
    db!.adminResetKey(reg.agentName);

    // Lock should be released
    const lock = db!.queryLock('/reset/file.dart');
    if (lock.ok) {
      expect(lock.value).toBeNull();
    }
  });

  it('adminResetKey fails for nonexistent agent', () => {
    const result = db!.adminResetKey('nonexistent-agent');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERR_NOT_FOUND);
    }
  });

  it('new key works after reset', () => {
    // Register agent
    const regResult = db!.register('new-key-works-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;

    // Reset key
    const resetResult = db!.adminResetKey(reg.agentName);
    expect(resetResult.ok).toBe(true);
    if (!resetResult.ok) return;
    const newReg = resetResult.value as AgentRegistration;

    // New key should work
    const authResult = db!.authenticate(newReg.agentName, newReg.agentKey);
    expect(authResult.ok).toBe(true);
  });
});
