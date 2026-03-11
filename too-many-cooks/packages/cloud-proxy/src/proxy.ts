/// Cloud proxy stdio MCP server.
///
/// Presents the same 5 MCP tools as the local server, but routes all
/// operations through the TMC Cloud API with E2E encryption.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  createConsoleLogger,
  createDataConfig,
  createMcpServerForDb,
} from "@too-many-cooks/core";

import type { CloudProxyConfig } from "./config.js";
import { createCloudDb } from "./db-cloud.js";
import { withEncryption } from "./encryption-middleware.js";

/** Placeholder db path for cloud mode (no local DB). */
const CLOUD_DB_PATH = ":cloud:";

/** Exit code for fatal startup errors. */
const FATAL_EXIT_CODE = 1;

/** Start the cloud proxy MCP server over stdio. */
export const startProxy = async (
  config: CloudProxyConfig,
): Promise<void> => {
  const log = createConsoleLogger();
  log.info("TMC Cloud Proxy starting...");

  const rawDb = createCloudDb(
    config.apiUrl,
    config.apiKey,
    config.workspaceId,
  );
  const db = withEncryption(rawDb, config.currentKey, config.keychain);

  const dataConfig = createDataConfig({ dbPath: CLOUD_DB_PATH });
  const serverResult = createMcpServerForDb(db, dataConfig, log);

  if (!serverResult.ok) {
    log.error(`Failed to create MCP server: ${serverResult.error}`);
    process.exit(FATAL_EXIT_CODE);
  }

  const transport = new StdioServerTransport();
  await serverResult.value.connect(transport);
  log.info("TMC Cloud Proxy connected via stdio");
};
