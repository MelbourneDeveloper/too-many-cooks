/// Status tool - system overview.

import type { Logger } from "../logger.js";
import {
  type TooManyCooksDb,
  type DbError,
  agentIdentityToJson,
  agentPlanToJson,
  dbErrorToJson,
  fileLockToJson,
  messageToJson,
} from "../data/data.js";
import {
  textContent,
  type CallToolResult,
  type ToolCallback,
} from "../types.js";

/** Input schema for status tool (no inputs required). */
export const STATUS_INPUT_SCHEMA = {
  type: "object",
  properties: {},
} as const;

/** Tool config for status. */
export const STATUS_TOOL_CONFIG = {
  title: "Status",
  description: "Get system overview: agents, locks, plans, messages",
  inputSchema: STATUS_INPUT_SCHEMA,
  outputSchema: null,
  annotations: null,
} as const;

/** Create status tool handler. */
export const createStatusHandler = (
  db: TooManyCooksDb,
  logger: Logger,
): ToolCallback =>
  async (_args, _meta) => {
    const log = logger.child({ tool: "status" });

    const agentsResult = db.listAgents();
    if (!agentsResult.ok) return makeErrorResult(agentsResult.error);
    const agents = agentsResult.value.map(agentIdentityToJson);

    const locksResult = db.listLocks();
    if (!locksResult.ok) return makeErrorResult(locksResult.error);
    const locks = locksResult.value.map(fileLockToJson);

    const plansResult = db.listPlans();
    if (!plansResult.ok) return makeErrorResult(plansResult.error);
    const plans = plansResult.value.map(agentPlanToJson);

    const messagesResult = db.listAllMessages();
    if (!messagesResult.ok) return makeErrorResult(messagesResult.error);
    const messages = messagesResult.value.map(messageToJson);

    log.debug("Status queried");

    return {
      content: [
        textContent(JSON.stringify({ agents, locks, plans, messages })),
      ],
      isError: false,
    };
  };

const makeErrorResult = (e: DbError): CallToolResult => ({
  content: [textContent(JSON.stringify(dbErrorToJson(e)))],
  isError: true,
});
