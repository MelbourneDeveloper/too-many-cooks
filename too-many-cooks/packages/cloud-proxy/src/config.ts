/// Cloud proxy configuration from environment variables.

import { type Result, error, success } from "@too-many-cooks/core";

import { type Keychain, type WorkspaceKey, deriveWorkspaceKey } from "./crypto.js";

/** Environment variable name for the API key. */
const ENV_API_KEY = "TMC_API_KEY";

/** Environment variable name for the workspace ID. */
const ENV_WORKSPACE_ID = "TMC_WORKSPACE_ID";

/** Environment variable name for the workspace secret (current). */
const ENV_WORKSPACE_SECRET = "TMC_WORKSPACE_SECRET";

/** Environment variable name for the previous workspace secret (rotation). */
const ENV_WORKSPACE_SECRET_V1 = "TMC_WORKSPACE_SECRET_V1";

/** Environment variable name for the cloud API URL. */
const ENV_API_URL = "TMC_API_URL";

/** Error prefix for missing environment variables. */
const ERR_MISSING_ENV = "Missing required env var: ";

/** Default production API URL. */
const DEFAULT_API_URL =
  "https://your-project.supabase.co/functions/v1/tmc-api";

/** Cloud proxy configuration. */
export type CloudProxyConfig = {
  readonly apiKey: string;
  readonly workspaceId: string;
  readonly apiUrl: string;
  readonly keychain: Keychain;
  readonly currentKey: WorkspaceKey;
};

/** Build a keychain from current + optional previous passphrase. */
const buildKeychain = (
  currentPassphrase: string,
  workspaceId: string,
  previousPassphrase: string | undefined,
): { readonly keychain: Keychain; readonly currentKey: WorkspaceKey } => {
  const currentKey = deriveWorkspaceKey(currentPassphrase, workspaceId);
  const keys: WorkspaceKey[] = [currentKey];
  if (previousPassphrase !== undefined) {
    keys.push({
      ...deriveWorkspaceKey(previousPassphrase, workspaceId),
      version: currentKey.version - 1,
    });
  }
  return { keychain: keys, currentKey };
};

/** Parse and validate cloud proxy config from environment. */
export const parseConfig = (
  env: Record<string, string | undefined>,
): Result<CloudProxyConfig, string> => {
  const apiKey = env[ENV_API_KEY];
  if (apiKey === undefined || apiKey === "") {
    return error(`${ERR_MISSING_ENV}${ENV_API_KEY}`);
  }
  const workspaceId = env[ENV_WORKSPACE_ID];
  if (workspaceId === undefined || workspaceId === "") {
    return error(`${ERR_MISSING_ENV}${ENV_WORKSPACE_ID}`);
  }
  const secret = env[ENV_WORKSPACE_SECRET];
  if (secret === undefined || secret === "") {
    return error(`${ERR_MISSING_ENV}${ENV_WORKSPACE_SECRET}`);
  }
  const apiUrl = env[ENV_API_URL] ?? DEFAULT_API_URL;
  const { keychain, currentKey } = buildKeychain(
    secret,
    workspaceId,
    env[ENV_WORKSPACE_SECRET_V1],
  );
  return success({ apiKey, workspaceId, apiUrl, keychain, currentKey });
};
