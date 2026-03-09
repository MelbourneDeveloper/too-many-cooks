/// Tests for database creation and lifecycle.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

import {
  type TooManyCooksDb,
  createDataConfig,
  createDb,
  ERR_NOT_FOUND,
  ERR_UNAUTHORIZED,
  ERR_LOCK_HELD,
  ERR_LOCK_EXPIRED,
  ERR_VALIDATION,
  ERR_DATABASE,
} from '../lib/src/data/data.js';
import { SCHEMA_VERSION } from '../lib/src/data/schema.js';

const deleteIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  } catch {
    // ignore
  }
};

const deleteDirIfExists = (path: string): void => {
  try {
    if (fs.existsSync(path)) {
      fs.rmSync(path, { recursive: true });
    }
  } catch {
    // ignore
  }
};

describe('database', () => {
  it('createDb succeeds with valid path', () => {
    const testDbPath = '.test_create_db.db' as const;
    deleteIfExists(testDbPath);

    const config = createDataConfig({ dbPath: testDbPath });
    const result = createDb(config);
    expect(result.ok).toBe(true);

    if (result.ok) {
      result.value.close();
    }
    deleteIfExists(testDbPath);
  });

  it('createDb creates parent directory if needed', () => {
    const testDir = '.test_nested_dir' as const;
    const testDbPath = `${testDir}/subdir/data.db`;
    deleteDirIfExists(testDir);

    const config = createDataConfig({ dbPath: testDbPath });
    const result = createDb(config);
    expect(result.ok).toBe(true);

    if (result.ok) {
      result.value.close();
    }
    deleteDirIfExists(testDir);
  });

  it('close succeeds', () => {
    const testDbPath = '.test_close.db' as const;
    deleteIfExists(testDbPath);

    const config = createDataConfig({ dbPath: testDbPath });
    const createResult = createDb(config);
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;
    const db = createResult.value;

    const closeResult = db.close();
    expect(closeResult.ok).toBe(true);

    deleteIfExists(testDbPath);
  });

  it('schema version is set correctly', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });

  it('error codes are defined', () => {
    expect(ERR_NOT_FOUND).toBe('NOT_FOUND');
    expect(ERR_UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ERR_LOCK_HELD).toBe('LOCK_HELD');
    expect(ERR_LOCK_EXPIRED).toBe('LOCK_EXPIRED');
    expect(ERR_VALIDATION).toBe('VALIDATION');
    expect(ERR_DATABASE).toBe('DATABASE');
  });
});
