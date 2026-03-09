/// Tests for activate/deactivate agent state.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

import {
  type TooManyCooksDb,
  type AgentRegistration,
  createDataConfig,
  createDb,
  ERR_NOT_FOUND,
  ERR_UNAUTHORIZED,
} from '../lib/src/data/data.js';

const TEST_DB_PATH = '.test_active_state.db' as const;

const deleteIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore
  }
};

describe('active_state_test', () => {
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

  it('activate sets agent active', () => {
    db!.register('agent1');
    const result = db!.activate('agent1');
    expect(result.ok).toBe(true);
  });

  it('activate fails for nonexistent agent', () => {
    const result = db!.activate('nonexistent');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERR_NOT_FOUND);
    }
  });

  it('deactivate sets agent inactive', () => {
    db!.register('agent1');
    db!.activate('agent1');
    const result = db!.deactivate('agent1');
    expect(result.ok).toBe(true);
  });

  it('deactivate fails for nonexistent agent', () => {
    const result = db!.deactivate('nonexistent');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERR_NOT_FOUND);
    }
  });

  it('deactivateAll deactivates all agents', () => {
    db!.register('agent1');
    db!.register('agent2');
    db!.activate('agent1');
    db!.activate('agent2');
    const result = db!.deactivateAll();
    expect(result.ok).toBe(true);
  });

  it('deactivateAll succeeds with no agents', () => {
    const result = db!.deactivateAll();
    expect(result.ok).toBe(true);
  });

  it('lookupByKey returns agent name', () => {
    const reg = db!.register('agent1');
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;
    const key = (reg.value as AgentRegistration).agentKey;
    const result = db!.lookupByKey(key);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('agent1');
    }
  });

  it('lookupByKey fails for invalid key', () => {
    const result = db!.lookupByKey('invalid-key');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ERR_UNAUTHORIZED);
    }
  });
});
