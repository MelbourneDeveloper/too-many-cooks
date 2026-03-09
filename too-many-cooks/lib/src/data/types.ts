/// Core types for Too Many Cooks data layer.

import { type Result, error, success } from "../result.js";
import type { DbError } from "./types.gen.js";

// Re-export generated model types and serializers.
export * from "./types.gen.js";

/** Pattern for valid agent names: alphanumeric, hyphens, underscores. */
const VALID_AGENT_NAME = /^[a-zA-Z0-9_-]+$/;

/** Maximum agent name length. */
export const MAX_AGENT_NAME_LENGTH = 50;

/** Create a validated AgentIdentity. */
export const agentIdentity = (params: {
  readonly agentName: string;
  readonly registeredAt: number;
  readonly lastActive: number;
}): Result<
  { readonly agentName: string; readonly registeredAt: number; readonly lastActive: number },
  DbError
> =>
  !VALID_AGENT_NAME.test(params.agentName)
    ? error({
        code: ERR_VALIDATION,
        message: "Agent name must be alphanumeric (hyphens/underscores ok)",
      })
    : params.agentName.length > MAX_AGENT_NAME_LENGTH
      ? error({
          code: ERR_VALIDATION,
          message: "Agent name must be 1-50 chars",
        })
      : success({
          agentName: params.agentName,
          registeredAt: params.registeredAt,
          lastActive: params.lastActive,
        });

/** Error code for resource not found. */
export const ERR_NOT_FOUND = "NOT_FOUND";

/** Error code for unauthorized access. */
export const ERR_UNAUTHORIZED = "UNAUTHORIZED";

/** Error code when lock is held by another agent. */
export const ERR_LOCK_HELD = "LOCK_HELD";

/** Error code when lock has expired. */
export const ERR_LOCK_EXPIRED = "LOCK_EXPIRED";

/** Error code for validation failures. */
export const ERR_VALIDATION = "VALIDATION";

/** Error code for database errors. */
export const ERR_DATABASE = "DATABASE";
