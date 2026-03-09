/// Tests for configuration utilities.

import { describe, it, expect } from 'vitest';

import {
  resolveDbPath,
  createDataConfig,
  createDataConfigFromWorkspace,
  defaultConfig,
  getWorkspaceFolder,
  DEFAULT_LOCK_TIMEOUT_MS,
  DEFAULT_MAX_MESSAGE_LENGTH,
  DEFAULT_MAX_PLAN_LENGTH,
} from '../lib/src/data/data.js';

describe('config', () => {
  it('resolveDbPath returns correct path', () => {
    const path = resolveDbPath('/workspace/project');
    expect(path).toBe('/workspace/project/.too_many_cooks/data.db');
  });

  it('createDataConfig uses provided values', () => {
    const config = createDataConfig({
      dbPath: '/custom/path.db',
      lockTimeoutMs: 30000,
      maxMessageLength: 500,
      maxPlanLength: 200,
    });
    expect(config.dbPath).toBe('/custom/path.db');
    expect(config.lockTimeoutMs).toBe(30000);
    expect(config.maxMessageLength).toBe(500);
    expect(config.maxPlanLength).toBe(200);
  });

  it('createDataConfig uses defaults', () => {
    const config = createDataConfig({ dbPath: '/path.db' });
    expect(config.dbPath).toBe('/path.db');
    expect(config.lockTimeoutMs).toBe(DEFAULT_LOCK_TIMEOUT_MS);
    expect(config.maxMessageLength).toBe(DEFAULT_MAX_MESSAGE_LENGTH);
    expect(config.maxPlanLength).toBe(DEFAULT_MAX_PLAN_LENGTH);
  });

  it('createDataConfigFromWorkspace creates config with resolved path', () => {
    const config = createDataConfigFromWorkspace('/my/workspace');
    expect(config.dbPath).toBe('/my/workspace/.too_many_cooks/data.db');
    expect(config.lockTimeoutMs).toBe(DEFAULT_LOCK_TIMEOUT_MS);
    expect(config.maxMessageLength).toBe(DEFAULT_MAX_MESSAGE_LENGTH);
    expect(config.maxPlanLength).toBe(DEFAULT_MAX_PLAN_LENGTH);
  });

  it('default constants have expected values', () => {
    expect(DEFAULT_LOCK_TIMEOUT_MS).toBe(600000);
    expect(DEFAULT_MAX_MESSAGE_LENGTH).toBe(200);
    expect(DEFAULT_MAX_PLAN_LENGTH).toBe(100);
  });

  it('getWorkspaceFolder returns a non-empty string', () => {
    const folder = getWorkspaceFolder();
    expect(folder.length).toBeGreaterThan(0);
  });

  it('defaultConfig uses getWorkspaceFolder for dbPath', () => {
    const expected = resolveDbPath(getWorkspaceFolder());
    expect(defaultConfig.dbPath).toBe(expected);
  });

  it('defaultConfig dbPath always ends with .too_many_cooks/data.db', () => {
    expect(defaultConfig.dbPath).toContain('.too_many_cooks/data.db');
  });

  it('defaultConfig uses default timeout and limits', () => {
    expect(defaultConfig.lockTimeoutMs).toBe(DEFAULT_LOCK_TIMEOUT_MS);
    expect(defaultConfig.maxMessageLength).toBe(DEFAULT_MAX_MESSAGE_LENGTH);
    expect(defaultConfig.maxPlanLength).toBe(DEFAULT_MAX_PLAN_LENGTH);
  });

  it('defaultConfig dbPath matches createDataConfigFromWorkspace', () => {
    const fromWorkspace = createDataConfigFromWorkspace(getWorkspaceFolder());
    expect(defaultConfig.dbPath).toBe(fromWorkspace.dbPath);
  });
});
