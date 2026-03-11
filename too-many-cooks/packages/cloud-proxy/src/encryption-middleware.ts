/// Encryption middleware for TooManyCooksDb.
///
/// Wraps a TooManyCooksDb instance, encrypting content fields on the way out
/// and decrypting them on the way in. Agent names/IDs stay plaintext.
///
/// Encrypted fields: lock.reason, message.content, plan.goal, plan.currentTask

import type {
  AgentPlan,
  DbError,
  FileLock,
  LockResult,
  Message,
  Result,
  TooManyCooksDb,
} from "@too-many-cooks/core";
import { error, success } from "@too-many-cooks/core";

import type { Keychain, WorkspaceKey } from "./crypto.js";
import { decrypt, encrypt } from "./crypto.js";

/** Error code when decryption fails. */
const ERR_DECRYPTION_FAILED = "DECRYPTION_FAILED";

/** Encrypt a nullable/optional string field. */
const encryptField = (
  value: string | null | undefined,
  wk: WorkspaceKey,
): string | null | undefined =>
  value === null || value === undefined ? value : encrypt(value, wk);

/** Decrypt a nullable string field, returning Result. */
const decryptField = (
  value: string | null,
  keychain: Keychain,
): Result<string | null, string> => {
  if (value === null) return success(null);
  return decrypt(value, keychain);
};

/** Decrypt a string field (non-nullable), returning Result. */
const decryptRequired = (
  value: string,
  keychain: Keychain,
): Result<string, string> => decrypt(value, keychain);

/** Decrypt a FileLock's reason field. */
const decryptLock = (
  lock: FileLock,
  keychain: Keychain,
): Result<FileLock, string> => {
  const reasonResult = decryptField(lock.reason, keychain);
  return reasonResult.ok
    ? success({ ...lock, reason: reasonResult.value })
    : error(reasonResult.error);
};

/** Decrypt a LockResult's nested lock reason. */
const decryptLockResult = (
  lr: LockResult,
  keychain: Keychain,
): Result<LockResult, string> => {
  if (lr.lock === undefined) return success(lr);
  const lockResult = decryptLock(lr.lock, keychain);
  return lockResult.ok
    ? success({ ...lr, lock: lockResult.value })
    : error(lockResult.error);
};

/** Decrypt a Message's content field. */
const decryptMessage = (
  msg: Message,
  keychain: Keychain,
): Result<Message, string> => {
  const contentResult = decryptRequired(msg.content, keychain);
  return contentResult.ok
    ? success({ ...msg, content: contentResult.value })
    : error(contentResult.error);
};

/** Decrypt an AgentPlan's goal and currentTask fields. */
const decryptPlan = (
  plan: AgentPlan,
  keychain: Keychain,
): Result<AgentPlan, string> => {
  const goalResult = decryptRequired(plan.goal, keychain);
  if (!goalResult.ok) return error(goalResult.error);
  const taskResult = decryptRequired(plan.currentTask, keychain);
  return taskResult.ok
    ? success({
      ...plan,
      goal: goalResult.value,
      currentTask: taskResult.value,
    })
    : error(taskResult.error);
};

/** Decrypt all items in a readonly array using a mapper. */
const decryptArray = <T>(
  items: readonly T[],
  keychain: Keychain,
  mapper: (item: T, kc: Keychain) => Result<T, string>,
): Result<readonly T[], string> => {
  const results: T[] = [];
  for (const item of items) {
    const r = mapper(item, keychain);
    if (!r.ok) return error(r.error);
    results.push(r.value);
  }
  return success(results);
};

/** Convert a crypto error to a DbError result. */
const toDbError = <T>(
  result: Result<T, string>,
): Result<T, DbError> =>
  result.ok
    ? success(result.value)
    : error({ code: ERR_DECRYPTION_FAILED, message: result.error });

/** Wrap a db Result through a decryption transform. */
const mapDbResult = async <T>(
  dbResult: Promise<Result<T, DbError>>,
  transform: (value: T, kc: Keychain) => Result<T, string>,
  keychain: Keychain,
): Promise<Result<T, DbError>> => {
  const result = await dbResult;
  if (!result.ok) return result;
  return toDbError(transform(result.value, keychain));
};

/** Create an encrypting wrapper around a TooManyCooksDb. */
export const withEncryption = (
  db: TooManyCooksDb,
  currentKey: WorkspaceKey,
  keychain: Keychain,
): TooManyCooksDb => ({
  register: (agentName) => db.register(agentName),
  authenticate: (n, k) => db.authenticate(n, k),
  lookupByKey: (k) => db.lookupByKey(k),
  listAgents: () => db.listAgents(),
  acquireLock: (fp, an, ak, reason, timeout) =>
    mapDbResult(
      db.acquireLock(fp, an, ak, encryptField(reason, currentKey), timeout),
      decryptLockResult,
      keychain,
    ),
  releaseLock: (fp, an, ak) => db.releaseLock(fp, an, ak),
  forceReleaseLock: (fp, an, ak) => db.forceReleaseLock(fp, an, ak),
  queryLock: async (fp) => {
    const result = await db.queryLock(fp);
    if (!result.ok || result.value === null) return result;
    return toDbError(decryptLock(result.value, keychain));
  },
  listLocks: async () =>
    mapDbResult(
      db.listLocks(),
      (locks, kc) => decryptArray(locks, kc, decryptLock),
      keychain,
    ),
  renewLock: (fp, an, ak, t) => db.renewLock(fp, an, ak, t),
  sendMessage: (from, key, to, content) =>
    db.sendMessage(from, key, to, encrypt(content, currentKey)),
  getMessages: async (an, ak, opts) =>
    mapDbResult(
      db.getMessages(an, ak, opts),
      (msgs, kc) => decryptArray(msgs, kc, decryptMessage),
      keychain,
    ),
  markRead: (id, an, ak) => db.markRead(id, an, ak),
  updatePlan: (an, ak, goal, task) =>
    db.updatePlan(
      an,
      ak,
      encrypt(goal, currentKey),
      encrypt(task, currentKey),
    ),
  getPlan: async (an) => {
    const result = await db.getPlan(an);
    if (!result.ok || result.value === null) return result;
    return toDbError(decryptPlan(result.value, keychain));
  },
  listPlans: async () =>
    mapDbResult(
      db.listPlans(),
      (plans, kc) => decryptArray(plans, kc, decryptPlan),
      keychain,
    ),
  listAllMessages: async () =>
    mapDbResult(
      db.listAllMessages(),
      (msgs, kc) => decryptArray(msgs, kc, decryptMessage),
      keychain,
    ),
  activate: (an) => db.activate(an),
  deactivate: (an) => db.deactivate(an),
  deactivateAll: () => db.deactivateAll(),
  close: () => db.close(),
  adminDeleteLock: (fp) => db.adminDeleteLock(fp),
  adminDeleteAgent: (an) => db.adminDeleteAgent(an),
  adminResetKey: (an) => db.adminResetKey(an),
  adminSendMessage: (from, to, content) =>
    db.adminSendMessage(from, to, encrypt(content, currentKey)),
  adminReset: () => db.adminReset(),
});
