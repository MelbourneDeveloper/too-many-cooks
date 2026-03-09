/// Configuration for Too Many Cooks MCP server.
///
/// Database path resolution
/// lives in the data package to guarantee a single source of truth.

export {
  type TooManyCooksDataConfig,
  createDataConfig,
  createDataConfigFromWorkspace,
  defaultConfig,
  DEFAULT_PORT as defaultPort,
  getServerPort,
  getWorkspaceFolder,
  resolveDbPath,
} from "./data/data.js";

import type { TooManyCooksDataConfig } from "./data/data.js";

/** Server configuration type alias for backwards compatibility. */
export type TooManyCooksConfig = TooManyCooksDataConfig;

/** Server binary relative path (output of build_mcp.sh). */
export const SERVER_BINARY = "build/bin/server_node.js";
