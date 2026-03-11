/// Cloud TooManyCooksDb implementation.
///
/// Makes HTTPS calls to the TMC Cloud Edge Function instead of SQLite queries.
/// Each method maps 1:1 to a POST endpoint on the Edge Function.

import type {
  DbError,
  Result,
  TooManyCooksDb,
} from "@too-many-cooks/core";
import {
  agentIdentityFromJson,
  agentPlanFromJson,
  agentRegistrationFromJson,
  fileLockFromJson,
  lockResultFromJson,
  messageFromJson,
} from "@too-many-cooks/core";

/** Content-Type header value for JSON requests. */
const CONTENT_TYPE_JSON = "application/json";

/** Authorization header prefix. */
const AUTH_BEARER_PREFIX = "Bearer ";

/** Custom header for workspace ID. */
const WORKSPACE_ID_HEADER = "X-Workspace-Id";

/** HTTP method for all API calls. */
const HTTP_METHOD = "POST";

/** Error code for network/HTTP failures. */
const ERR_NETWORK = "NETWORK_ERROR";

/** Default error message when API returns no details. */
const ERR_UNKNOWN_API = "Unknown API error";

/** Content-Type header key. */
const CONTENT_TYPE_HEADER = "Content-Type";

/** Authorization header key. */
const AUTHORIZATION_HEADER = "Authorization";

/** API endpoint names. Mirror TooManyCooksDb interface methods. */
const EP_REGISTER = "register";
const EP_AUTHENTICATE = "authenticate";
const EP_LOOKUP_BY_KEY = "lookupByKey";
const EP_LIST_AGENTS = "listAgents";
const EP_ACQUIRE_LOCK = "acquireLock";
const EP_RELEASE_LOCK = "releaseLock";
const EP_FORCE_RELEASE_LOCK = "forceReleaseLock";
const EP_QUERY_LOCK = "queryLock";
const EP_LIST_LOCKS = "listLocks";
const EP_RENEW_LOCK = "renewLock";
const EP_SEND_MESSAGE = "sendMessage";
const EP_GET_MESSAGES = "getMessages";
const EP_MARK_READ = "markRead";
const EP_UPDATE_PLAN = "updatePlan";
const EP_GET_PLAN = "getPlan";
const EP_LIST_PLANS = "listPlans";
const EP_LIST_ALL_MESSAGES = "listAllMessages";
const EP_ACTIVATE = "activate";
const EP_DEACTIVATE = "deactivate";
const EP_DEACTIVATE_ALL = "deactivateAll";
const EP_CLOSE = "close";
const EP_ADMIN_DELETE_LOCK = "adminDeleteLock";
const EP_ADMIN_DELETE_AGENT = "adminDeleteAgent";
const EP_ADMIN_RESET_KEY = "adminResetKey";
const EP_ADMIN_SEND_MESSAGE = "adminSendMessage";
const EP_ADMIN_RESET = "adminReset";

/** Type guard: value is a plain object (Record). */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** API response shape matching Result<T, DbError>. */
type ApiResponse = {
  readonly ok: boolean;
  readonly value?: unknown;
  readonly error?: { readonly code: string; readonly message: string };
};

/** Type guard: validates an unknown JSON payload is an ApiResponse. */
const isApiResponse = (v: unknown): v is ApiResponse =>
  isRecord(v) && typeof v.ok === "boolean";

/** Extract a DbError from an API error response. */
const extractDbError = (body: ApiResponse): DbError => ({
  code: body.error?.code ?? ERR_NETWORK,
  message: body.error?.message ?? ERR_UNKNOWN_API,
});

/** Value extractor: ignores payload, returns void. */
const extractVoid = (_v: unknown): undefined => undefined;

/** Value extractor: narrows to string via type guard. */
const extractString = (v: unknown): string =>
  typeof v === "string" ? v : "";

/** Create a value extractor that applies a mapper to a Record. */
const mapped = <T>(
  mapper: (raw: Record<string, unknown>) => T,
): (v: unknown) => T =>
  (v) => mapper(isRecord(v) ? v : {});

/** Create a value extractor that maps an array of Records. */
const mappedArray = <T>(
  mapper: (raw: Record<string, unknown>) => T,
): (v: unknown) => readonly T[] =>
  (v) =>
    Array.isArray(v)
      ? v.map((item: unknown) => mapper(isRecord(item) ? item : {}))
      : [];

/** Create a value extractor for nullable single-item responses. */
const mappedNullable = <T>(
  mapper: (raw: Record<string, unknown>) => T,
): (v: unknown) => T | null =>
  (v) =>
    v === null || v === undefined ? null : mapper(isRecord(v) ? v : {});

/** Generic API response parser. Replaces 5 specialized parse functions. */
const parseApiResponse = <T>(
  body: ApiResponse,
  extract: (value: unknown) => T,
): Result<T, DbError> =>
  body.ok
    ? { ok: true, value: extract(body.value) }
    : { ok: false, error: extractDbError(body) };

/** Create a cloud-backed TooManyCooksDb that calls the Edge Function. */
export const createCloudDb = (
  apiUrl: string,
  apiKey: string,
  workspaceId: string,
): TooManyCooksDb => {
  const call = async (
    method: string,
    args: Record<string, unknown>,
  ): Promise<ApiResponse> => {
    const response = await fetch(`${apiUrl}/${method}`, {
      method: HTTP_METHOD,
      headers: {
        [CONTENT_TYPE_HEADER]: CONTENT_TYPE_JSON,
        [AUTHORIZATION_HEADER]: `${AUTH_BEARER_PREFIX}${apiKey}`,
        [WORKSPACE_ID_HEADER]: workspaceId,
      },
      body: JSON.stringify(args),
    });
    const json: unknown = await response.json();
    return isApiResponse(json)
      ? json
      : { ok: false, error: { code: ERR_NETWORK, message: ERR_UNKNOWN_API } };
  };

  return {
    register: async (agentName) =>
      parseApiResponse(
        await call(EP_REGISTER, { agentName }),
        mapped(agentRegistrationFromJson),
      ),
    authenticate: async (agentName, agentKey) =>
      parseApiResponse(
        await call(EP_AUTHENTICATE, { agentName, agentKey }),
        mapped(agentIdentityFromJson),
      ),
    lookupByKey: async (agentKey) =>
      parseApiResponse(
        await call(EP_LOOKUP_BY_KEY, { agentKey }),
        extractString,
      ),
    listAgents: async () =>
      parseApiResponse(
        await call(EP_LIST_AGENTS, {}),
        mappedArray(agentIdentityFromJson),
      ),
    acquireLock: async (filePath, agentName, agentKey, reason, timeoutMs) =>
      parseApiResponse(
        await call(EP_ACQUIRE_LOCK, {
          filePath, agentName, agentKey, reason, timeoutMs,
        }),
        mapped(lockResultFromJson),
      ),
    releaseLock: async (filePath, agentName, agentKey) =>
      parseApiResponse(
        await call(EP_RELEASE_LOCK, { filePath, agentName, agentKey }),
        extractVoid,
      ),
    forceReleaseLock: async (filePath, agentName, agentKey) =>
      parseApiResponse(
        await call(EP_FORCE_RELEASE_LOCK, { filePath, agentName, agentKey }),
        extractVoid,
      ),
    queryLock: async (filePath) =>
      parseApiResponse(
        await call(EP_QUERY_LOCK, { filePath }),
        mappedNullable(fileLockFromJson),
      ),
    listLocks: async () =>
      parseApiResponse(
        await call(EP_LIST_LOCKS, {}),
        mappedArray(fileLockFromJson),
      ),
    renewLock: async (filePath, agentName, agentKey, timeoutMs) =>
      parseApiResponse(
        await call(EP_RENEW_LOCK, {
          filePath, agentName, agentKey, timeoutMs,
        }),
        extractVoid,
      ),
    sendMessage: async (fromAgent, fromKey, toAgent, content) =>
      parseApiResponse(
        await call("sendMessage", {
          fromAgent, fromKey, toAgent, content,
        }),
        extractString,
      ),
    getMessages: async (agentName, agentKey, options) =>
      parseApiResponse(
        await call("getMessages", {
          agentName, agentKey, unreadOnly: options?.unreadOnly,
        }),
        mappedArray(messageFromJson),
      ),
    markRead: async (messageId, agentName, agentKey) =>
      parseApiResponse(
        await call("markRead", { messageId, agentName, agentKey }),
        extractVoid,
      ),
    updatePlan: async (agentName, agentKey, goal, currentTask) =>
      parseApiResponse(
        await call("updatePlan", {
          agentName, agentKey, goal, currentTask,
        }),
        extractVoid,
      ),
    getPlan: async (agentName) =>
      parseApiResponse(
        await call("getPlan", { agentName }),
        mappedNullable(agentPlanFromJson),
      ),
    listPlans: async () =>
      parseApiResponse(
        await call("listPlans", {}),
        mappedArray(agentPlanFromJson),
      ),
    listAllMessages: async () =>
      parseApiResponse(
        await call("listAllMessages", {}),
        mappedArray(messageFromJson),
      ),
    activate: async (agentName) =>
      parseApiResponse(
        await call("activate", { agentName }),
        extractVoid,
      ),
    deactivate: async (agentName) =>
      parseApiResponse(
        await call("deactivate", { agentName }),
        extractVoid,
      ),
    deactivateAll: async () =>
      parseApiResponse(await call("deactivateAll", {}), extractVoid),
    close: async () =>
      parseApiResponse(await call("close", {}), extractVoid),
    adminDeleteLock: async (filePath) =>
      parseApiResponse(
        await call("adminDeleteLock", { filePath }),
        extractVoid,
      ),
    adminDeleteAgent: async (agentName) =>
      parseApiResponse(
        await call("adminDeleteAgent", { agentName }),
        extractVoid,
      ),
    adminResetKey: async (agentName) =>
      parseApiResponse(
        await call("adminResetKey", { agentName }),
        mapped(agentRegistrationFromJson),
      ),
    adminSendMessage: async (fromAgent, toAgent, content) =>
      parseApiResponse(
        await call("adminSendMessage", { fromAgent, toAgent, content }),
        extractString,
      ),
    adminReset: async () =>
      parseApiResponse(await call("adminReset", {}), extractVoid),
  };
};
