/// Test: /admin/reset MUST preserve agent identities.
///
/// BUG: /admin/reset does DELETE FROM identity, which nukes
/// all agent registrations. After reset, agents cannot
/// reconnect with their saved keys and must re-register —
/// creating duplicate identities and polluting the agent list.
///
/// Reset should clear transient data (locks, messages, plans)
/// but preserve agent identities so agents can reconnect.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';

import {
  type TooManyCooksDb,
  type AgentRegistration,
  createDataConfig,
  createDb,
} from '../lib/src/data/data.js';

const TEST_DB_PATH = '.test_admin_reset_identity.db' as const;

const deleteIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore
  }
};

describe('admin_reset_preserves_identity_test', () => {
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

  it('agent can reconnect with saved key after adminReset', () => {
    // 1. Register an agent and save the key
    const regResult = db!.register('persistent-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;
    expect(reg.agentKey.length).toBe(64);

    // 2. Call adminReset (should clear transient data)
    const resetResult = db!.adminReset();
    expect(resetResult.ok).toBe(true);

    // 3. Try to reconnect with the saved key
    const lookupResult = db!.lookupByKey(reg.agentKey);

    // 4. ASSERT: reconnection MUST succeed
    expect(lookupResult.ok).toBe(true);
    if (lookupResult.ok) {
      expect(lookupResult.value).toBe('persistent-agent');
    }
  });

  it('adminReset clears locks and plans', () => {
    // Register and create transient data
    const regResult = db!.register('transient-agent');
    expect(regResult.ok).toBe(true);
    if (!regResult.ok) return;
    const reg = regResult.value as AgentRegistration;
    db!.activate('transient-agent');
    db!.acquireLock(
      'test.dart',
      reg.agentName,
      reg.agentKey,
      'testing',
      600000,
    );
    db!.updatePlan(reg.agentName, reg.agentKey, 'test goal', 'test task');

    // Reset
    db!.adminReset();

    // Locks and plans should be empty
    const locksResult = db!.listLocks();
    expect(locksResult.ok).toBe(true);
    if (locksResult.ok) {
      expect(locksResult.value).toHaveLength(0);
    }

    const plansResult = db!.listPlans();
    expect(plansResult.ok).toBe(true);
    if (plansResult.ok) {
      expect(plansResult.value).toHaveLength(0);
    }
  });
});
