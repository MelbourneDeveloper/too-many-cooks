/// Register tool - agent registration and reconnection.

import type { Logger } from "../logger.js";
import type { NotificationEmitter } from "../notifications.js";
import {
  EVENT_AGENT_ACTIVATED,
  EVENT_AGENT_REGISTERED,
} from "../notifications.js";
import {
  type TooManyCooksDb,
  agentRegistrationToJson,
  dbErrorToJson,
} from "../data/data.js";
import {
  textContent,
  type SessionSetter,
  type CallToolResult,
  type ToolCallback,
} from "../types.js";

/** Input schema for register tool. */
export const REGISTER_INPUT_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "Your unique agent name, 1-50 chars. " +
        "For FIRST registration only. Do NOT send with key.",
    },
    key: {
      type: "string",
      description:
        "Your secret key from a previous registration. " +
        "For RECONNECT only. Do NOT send with name.",
    },
  },
} as const;

/** Tool config for register. */
export const REGISTER_TOOL_CONFIG = {
  title: "Register Agent",
  description:
    "Register a new agent or reconnect with an existing key. " +
    'FIRST TIME: pass "name" only. Returns key \u2014 store it! ' +
    'RECONNECT: pass "key" only. Server looks up your name. ' +
    "Passing both name and key is an error. " +
    'Example first: {"name": "my-agent"} ' +
    'Example reconnect: {"key": "abc123..."}',
  inputSchema: REGISTER_INPUT_SCHEMA,
  outputSchema: null,
  annotations: null,
} as const;

/** Create register tool handler. */
export const createRegisterHandler = (
  db: TooManyCooksDb,
  emitter: NotificationEmitter,
  logger: Logger,
  setSession: SessionSetter,
): ToolCallback =>
  async (args, _meta) => {
    const nameArg =
      typeof args["name"] === "string" ? args["name"] : null;
    const keyArg =
      typeof args["key"] === "string" ? args["key"] : null;
    const hasName = nameArg !== null && nameArg.length > 0;
    const hasKey = keyArg !== null && keyArg.length > 0;

    if (hasName && hasKey) {
      return errorContent("validation: pass name OR key, not both");
    }
    if (!hasName && !hasKey) {
      return errorContent("missing_parameter: name or key required");
    }

    // Reconnect path: key only
    if (hasKey) {
      const log = logger.child({ tool: "register", mode: "reconnect" });
      const lookupResult = db.lookupByKey(keyArg);
      if (!lookupResult.ok) {
        log.warn(`Reconnect failed: ${lookupResult.error.code}`);
        return {
          content: [
            textContent(JSON.stringify(dbErrorToJson(lookupResult.error))),
          ],
          isError: true,
        };
      }
      setSession(lookupResult.value, keyArg);
      db.activate(lookupResult.value);
      emitter.emit(EVENT_AGENT_ACTIVATED, {
        agent_name: lookupResult.value,
      });
      log.info(`Agent reconnected: ${lookupResult.value}`);
      return {
        content: [
          textContent(
            JSON.stringify({
              agent_name: lookupResult.value,
              agent_key: keyArg,
            }),
          ),
        ],
        isError: false,
      };
    }

    // First registration: name only
    if (nameArg === null) {
      return errorContent("missing_parameter: name required");
    }

    const log = logger.child({ tool: "register", agentName: nameArg });
    let reg = db.register(nameArg);

    if (!reg.ok && reg.error.message.includes("already registered")) {
      const resetResult = db.adminResetKey(nameArg);
      if (!resetResult.ok) {
        log.warn(`Re-registration failed: ${resetResult.error.code}`);
        return {
          content: [
            textContent(JSON.stringify(dbErrorToJson(resetResult.error))),
          ],
          isError: true,
        };
      }
      reg = resetResult;
    }

    if (!reg.ok) {
      log.warn(`Registration failed: ${reg.error.code}`);
      return {
        content: [textContent(JSON.stringify(dbErrorToJson(reg.error)))],
        isError: true,
      };
    }

    setSession(reg.value.agentName, reg.value.agentKey);
    db.activate(reg.value.agentName);
    emitter.emit(EVENT_AGENT_REGISTERED, {
      agent_name: reg.value.agentName,
      registered_at: Date.now(),
    });
    log.info(`Agent registered: ${reg.value.agentName}`);
    return {
      content: [
        textContent(JSON.stringify(agentRegistrationToJson(reg.value))),
      ],
      isError: false,
    };
  };

const errorContent = (msg: string): CallToolResult => ({
  content: [textContent(JSON.stringify({ error: msg }))],
  isError: true,
});
