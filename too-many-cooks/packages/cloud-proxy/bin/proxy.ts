#!/usr/bin/env node
/// CLI entry point for the TMC Cloud Proxy.

import { parseConfig } from "../src/config.js";
import { startProxy } from "../src/proxy.js";

/** Exit code for configuration errors. */
const CONFIG_EXIT_CODE = 1;

const configResult = parseConfig(process.env);
if (!configResult.ok) {
  console.error(`[TMC Cloud Proxy] ${configResult.error}`);
  process.exit(CONFIG_EXIT_CODE);
}

await startProxy(configResult.value);
