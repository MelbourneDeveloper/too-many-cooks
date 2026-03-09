/// Message tool - inter-agent messaging.

import type { Logger } from "../logger.js";
import type { NotificationEmitter } from "../notifications.js";
import { EVENT_MESSAGE_SENT } from "../notifications.js";
import {
  type TooManyCooksDb,
  type DbError,
  dbErrorToJson,
  messageToJson,
} from "../data/data.js";
import {
  textContent,
  type SessionGetter,
  type CallToolResult,
  type ToolCallback,
} from "../types.js";

/** Input schema for message tool. */
export const MESSAGE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["send", "get", "mark_read"],
      description: "Message action to perform",
    },
    to_agent: {
      type: "string",
      description: "Recipient name or * for broadcast (for send)",
    },
    content: {
      type: "string",
      maxLength: 200,
      description: "Message content (for send). MUST be 200 chars or less.",
    },
    message_id: {
      type: "string",
      description: "Message ID (for mark_read)",
    },
    unread_only: {
      type: "boolean",
      description: "Only return unread messages (default: true)",
    },
  },
  required: ["action"],
} as const;

/** Tool config for message. */
export const MESSAGE_TOOL_CONFIG = {
  title: "Message",
  description:
    "Send/receive messages. You must register first. " +
    "REQUIRED: action (send|get|mark_read). " +
    "For send: to_agent, content. For mark_read: message_id. " +
    'Example send: {"action":"send","to_agent":"other","content":"hello"}',
  inputSchema: MESSAGE_INPUT_SCHEMA,
  outputSchema: null,
  annotations: null,
} as const;

// ---------------------------------------------------------------------------
// Identity resolution (shared pattern with lock_tool)
// ---------------------------------------------------------------------------

type IdentityOk = {
  readonly isError: false;
  readonly agentName: string;
  readonly agentKey: string;
};
type IdentityErr = {
  readonly isError: true;
  readonly result: CallToolResult;
};

const resolveIdentity = (
  db: TooManyCooksDb,
  args: Record<string, unknown>,
  getSession: SessionGetter,
): IdentityOk | IdentityErr => {
  const keyOverride =
    typeof args["agent_key"] === "string" ? args["agent_key"] : null;
  if (keyOverride !== null) {
    const lookupResult = db.lookupByKey(keyOverride);
    if (!lookupResult.ok)
      return { isError: true, result: makeErrorResult(lookupResult.error) };
    return {
      isError: false,
      agentName: lookupResult.value,
      agentKey: keyOverride,
    };
  }
  const session = getSession();
  if (session === null) {
    return {
      isError: true,
      result: errorContent("not_registered: call register first"),
    };
  }
  return {
    isError: false,
    agentName: session.agentName,
    agentKey: session.agentKey,
  };
};

/** Create message tool handler. */
export const createMessageHandler = (
  db: TooManyCooksDb,
  emitter: NotificationEmitter,
  logger: Logger,
  getSession: SessionGetter,
): ToolCallback =>
  async (args, _meta) => {
    const actionArg = args["action"];
    if (typeof actionArg !== "string") {
      return errorContent("missing_parameter: action is required");
    }
    const action = actionArg;

    const identity = resolveIdentity(db, args, getSession);
    if (identity.isError) return identity.result;
    const { agentName, agentKey } = identity;
    const log = logger.child({ tool: "message", action });

    switch (action) {
      case "send":
        return handleSend(
          db,
          emitter,
          log,
          agentName,
          agentKey,
          typeof args["to_agent"] === "string" ? args["to_agent"] : null,
          typeof args["content"] === "string" ? args["content"] : null,
        );
      case "get":
        return handleGet(
          db,
          agentName,
          agentKey,
          typeof args["unread_only"] === "boolean"
            ? args["unread_only"]
            : true,
        );
      case "mark_read":
        return handleMarkRead(
          db,
          agentName,
          agentKey,
          typeof args["message_id"] === "string" ? args["message_id"] : null,
        );
      default:
        return {
          content: [
            textContent(
              JSON.stringify({ error: `Unknown action: ${action}` }),
            ),
          ],
          isError: true,
        };
    }
  };

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

const handleSend = (
  db: TooManyCooksDb,
  emitter: NotificationEmitter,
  log: Logger,
  agentName: string,
  agentKey: string,
  toAgent: string | null,
  content: string | null,
): CallToolResult => {
  if (toAgent === null || content === null) {
    return errorContent("send requires to_agent and content");
  }
  const result = db.sendMessage(agentName, agentKey, toAgent, content);
  if (!result.ok) return makeErrorResult(result.error);
  emitter.emitToAgent(
    EVENT_MESSAGE_SENT,
    {
      message_id: result.value,
      from_agent: agentName,
      to_agent: toAgent,
      content,
    },
    toAgent,
  );
  log.info(`Message sent from ${agentName} to ${toAgent}`);
  return {
    content: [
      textContent(
        JSON.stringify({ sent: true, message_id: result.value }),
      ),
    ],
    isError: false,
  };
};

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

const handleGet = (
  db: TooManyCooksDb,
  agentName: string,
  agentKey: string,
  unreadOnly: boolean,
): CallToolResult => {
  const result = db.getMessages(agentName, agentKey, { unreadOnly });
  if (!result.ok) return makeErrorResult(result.error);
  return {
    content: [
      textContent(
        JSON.stringify({ messages: result.value.map(messageToJson) }),
      ),
    ],
    isError: false,
  };
};

// ---------------------------------------------------------------------------
// Mark read
// ---------------------------------------------------------------------------

const handleMarkRead = (
  db: TooManyCooksDb,
  agentName: string,
  agentKey: string,
  messageId: string | null,
): CallToolResult => {
  if (messageId === null) {
    return errorContent("mark_read requires message_id");
  }
  const result = db.markRead(messageId, agentName, agentKey);
  if (!result.ok) return makeErrorResult(result.error);
  return {
    content: [textContent(JSON.stringify({ marked: true }))],
    isError: false,
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeErrorResult = (e: DbError): CallToolResult => ({
  content: [textContent(JSON.stringify(dbErrorToJson(e)))],
  isError: true,
});

const errorContent = (msg: string): CallToolResult => ({
  content: [textContent(JSON.stringify({ error: msg }))],
  isError: true,
});
