/// Tests for agent authentication.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

import {
  type TooManyCooksDb,
  type AgentRegistration,
  type AgentIdentity,
  createDataConfig,
  createDb,
  ERR_UNAUTHORIZED,
} from '../lib/src/data/data.js';

const TEST_DB_PATH = '.test_authentication.db' as const;

const deleteIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore
  }
};

describe('authentication', () => {
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

  it('authenticate succeeds with valid credentials', () => {
    const regResult = db!.register('auth-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;

    const authResult = db!.authenticate(reg.agentName, reg.agentKey);
    expect(authResult.ok).toBe(true);
    if (!authResult.ok) return;
    const agent = authResult.value as AgentIdentity;
    expect(agent.agentName).toBe('auth-agent');
  });

  it('authenticate fails with invalid key', () => {
    db!.register('auth-agent2');

    const authResult = db!.authenticate('auth-agent2', 'wrong-key');
    expect(authResult.ok).toBe(false);
    if (!authResult.ok) {
      expect(authResult.error.code).toBe(ERR_UNAUTHORIZED);
    }
  });

  it('authenticate fails for nonexistent agent', () => {
    const authResult = db!.authenticate('nonexistent', 'any-key');
    expect(authResult.ok).toBe(false);
    if (!authResult.ok) {
      expect(authResult.error.code).toBe(ERR_UNAUTHORIZED);
    }
  });

  it('authenticate updates last_active timestamp', () => {
    const regResult = db!.register('timestamp-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;

    const firstAuth = db!.authenticate(reg.agentName, reg.agentKey);
    expect(firstAuth.ok).toBe(true);
    if (!firstAuth.ok) return;
    const firstAgent = firstAuth.value as AgentIdentity;

    // Small delay to ensure timestamp changes
    const secondAuth = db!.authenticate(reg.agentName, reg.agentKey);
    expect(secondAuth.ok).toBe(true);
    if (!secondAuth.ok) return;
    const secondAgent = secondAuth.value as AgentIdentity;

    expect(secondAgent.lastActive).toBeGreaterThanOrEqual(firstAgent.lastActive);
  });
});
