/// Entry point for Too Many Cooks MCP server.
///
/// Starts a single Express HTTP server on port 4040 with:
/// - `/mcp` — MCP Streamable HTTP for agent connections
/// - `/admin/*` — REST + Streamable HTTP for the VSCode extension

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  type Logger,
  type LogMessage,
  LogLevel,
  logLevelName,
  logTransport,
  createLoggerWithContext,
  createLoggingContext,
} from "../lib/src/logger.js";
import { defaultConfig, getServerPort, getWorkspaceFolder, pathJoin } from "../lib/src/data/config.js";
import { createDb, type TooManyCooksDb } from "../lib/src/data/db.js";
import { createAgentEventHub, type AgentEventHub } from "../lib/src/notifications.js";
import { createAdminEventHub, registerAdminRoutes, type AdminEventHub } from "../lib/src/admin_routes.js";
import { createMcpServerForDb } from "../lib/src/server.js";

/** JSON-RPC bad request error response. */
const BAD_REQUEST_JSON =
  '{"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad Request"},"id":null}';

/** JSON-RPC session-not-found error response (404). */
const SESSION_NOT_FOUND_JSON =
  '{"jsonrpc":"2.0","error":{"code":-32001,"message":"Session not found"},"id":null}';

const main = async (): Promise<void> => {
  const log = createLogger();
  log.info("Server starting...");
  try {
    await startServer(log);
  } catch (e) {
    log.fatal("Fatal error", { error: `${e}` });
    throw e;
  }
};

const startServer = async (log: Logger): Promise<void> => {
  log.info("Creating server...");

  const cfg = defaultConfig;

  const dbResult = createDb(cfg);
  if (!dbResult.ok) throw new Error(dbResult.error);
  const db = dbResult.value;
  log.info("Database created.");

  const transports = new Map<string, StreamableHTTPServerTransport>();
  const agentHub = createAgentEventHub();
  const adminHub = createAdminEventHub();

  const app = express();

  registerAdminRoutes(app, db, adminHub);

  // Admin Streamable HTTP routes (/admin/events)
  app.post("/admin/events", asyncHandler(adminPostHandler(adminHub, log), log));
  app.get("/admin/events", asyncHandler(adminGetDeleteHandler(adminHub), log));
  app.delete("/admin/events", asyncHandler(adminGetDeleteHandler(adminHub), log));

  // MCP Streamable HTTP routes
  app.post("/mcp", asyncHandler(mcpPostHandler(transports, db, cfg, log, adminHub, agentHub), log));
  app.get("/mcp", asyncHandler(mcpGetDeleteHandler(transports, agentHub), log));
  app.delete("/mcp", asyncHandler(mcpGetDeleteHandler(transports, agentHub), log));

  const port = getServerPort();
  app.listen(port, () => {
    log.info("Server listening", { port });
  });

  // Keep event loop alive
  setInterval(() => {}, 60000);
  await new Promise<void>(() => {});
};

/** Check if a parsed JSON body is an MCP initialize request. */
const isInitializeRequest = (body: unknown): boolean => {
  if (typeof body !== "object" || body === null) return false;
  const method = (body as Record<string, unknown>)["method"];
  return method === "initialize";
};

/** POST /mcp handler. */
const mcpPostHandler = (
  transports: Map<string, StreamableHTTPServerTransport>,
  db: TooManyCooksDb,
  cfg: typeof defaultConfig,
  log: Logger,
  adminHub: AdminEventHub,
  agentHub: AgentEventHub,
): ((req: Request, res: Response) => Promise<void>) =>
  async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const body = req.body;

    if (sessionId !== undefined && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res, body);
      return;
    }

    if (sessionId !== undefined) {
      res.status(404).send(SESSION_NOT_FOUND_JSON);
      return;
    }

    if (isInitializeRequest(body)) {
      let transportRef: StreamableHTTPServerTransport | undefined;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sid: string) => {
          log.info("Session init", { sessionId: sid });
          if (transportRef !== undefined) {
            transports.set(sid, transportRef);
          }
        },
      });
      transportRef = transport;

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid !== undefined) {
          log.info("Session closed", { sessionId: sid });
          transports.delete(sid);
          agentHub.servers.delete(sid);
          agentHub.sessionAgentNames.delete(sid);
          agentHub.activeSseSessions.delete(sid);
        }
      };

      const serverResult = createMcpServerForDb(db, cfg, log, {
        adminPush: adminHub.pushEvent,
        agentPush: agentHub.pushEvent,
        agentPushToAgent: agentHub.pushToAgent,
        onSessionSet: (agentName: string) => {
          const sid = transport.sessionId;
          if (sid !== undefined) {
            agentHub.sessionAgentNames.set(sid, agentName);
          }
        },
      });
      if (!serverResult.ok) throw new Error(serverResult.error);
      const server = serverResult.value;
      await server.connect(transport);
      await transport.handleRequest(req, res, body);

      const sid = transport.sessionId;
      if (sid !== undefined) {
        agentHub.servers.set(sid, server);
      }
      return;
    }

    res.status(400).send(BAD_REQUEST_JSON);
  };

/** GET/DELETE /mcp handler. */
const mcpGetDeleteHandler = (
  transports: Map<string, StreamableHTTPServerTransport>,
  agentHub: AgentEventHub,
): ((req: Request, res: Response) => Promise<void>) =>
  async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId === undefined) {
      res.status(400).send("Missing session ID");
      return;
    }
    if (!transports.has(sessionId)) {
      res.status(404).send(SESSION_NOT_FOUND_JSON);
      return;
    }
    agentHub.activeSseSessions.add(sessionId);
    await transports.get(sessionId)!.handleRequest(req, res);
  };

/** POST /admin/events handler. */
const adminPostHandler = (
  hub: AdminEventHub,
  log: Logger,
): ((req: Request, res: Response) => Promise<void>) =>
  async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const body = req.body;

    if (sessionId !== undefined && hub.transports.has(sessionId)) {
      await hub.transports.get(sessionId)!.handleRequest(req, res, body);
      return;
    }

    if (sessionId !== undefined) {
      res.status(404).send(SESSION_NOT_FOUND_JSON);
      return;
    }

    if (isInitializeRequest(body)) {
      let transportRef: StreamableHTTPServerTransport | undefined;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sid: string) => {
          log.info("Admin session init", { sessionId: sid });
          if (transportRef !== undefined) {
            hub.transports.set(sid, transportRef);
          }
        },
      });
      transportRef = transport;

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid !== undefined) {
          log.info("Admin session closed", { sessionId: sid });
          hub.transports.delete(sid);
          hub.servers.delete(sid);
        }
      };

      const server = new McpServer(
        { name: "too-many-cooks", version: "0.1.0" },
        { capabilities: { logging: {} } },
      );
      await server.connect(transport);
      await transport.handleRequest(req, res, body);

      const sid = transport.sessionId;
      if (sid !== undefined) {
        hub.servers.set(sid, server);
      }
      return;
    }

    res.status(400).send(BAD_REQUEST_JSON);
  };

/** GET/DELETE /admin/events handler. */
const adminGetDeleteHandler = (
  hub: AdminEventHub,
): ((req: Request, res: Response) => Promise<void>) =>
  async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId === undefined) {
      res.status(400).send("Missing session ID");
      return;
    }
    if (!hub.transports.has(sessionId)) {
      res.status(404).send(SESSION_NOT_FOUND_JSON);
      return;
    }
    await hub.transports.get(sessionId)!.handleRequest(req, res);
  };

/** Wrap an async handler for Express. */
const asyncHandler = (
  fn: (req: Request, res: Response) => Promise<void>,
  log: Logger,
): ((req: Request, res: Response) => void) =>
  (req, res) => {
    fn(req, res).catch((e: unknown) => {
      log.error("Request error", { error: `${e}` });
    });
  };

const resolveLogFilePath = (): string => {
  const logsDir = pathJoin([getWorkspaceFolder(), "logs"]);
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");
  return pathJoin([logsDir, `mcp-server-${timestamp}.log`]);
};

const createLogger = (): Logger => {
  const logFilePath = resolveLogFilePath();
  return createLoggerWithContext(
    createLoggingContext({
      transports: [
        logTransport(createConsoleTransport()),
        logTransport(createFileTransport(logFilePath)),
      ],
      minimumLogLevel: LogLevel.debug,
    }),
  );
};

const formatLogLine = (message: LogMessage): string => {
  const level = logLevelName(message.logLevel);
  const data = message.structuredData;
  const dataStr =
    data !== undefined && Object.keys(data).length > 0
      ? ` ${JSON.stringify(data)}`
      : "";
  return `[TMC] [${message.timestamp.toISOString()}] [${level}] ${message.message}${dataStr}\n`;
};

const createConsoleTransport =
  () =>
  (message: LogMessage, minimumLogLevel: LogLevel): void => {
    if (message.logLevel < minimumLogLevel) return;
    console.error(formatLogLine(message).trimEnd());
  };

const createFileTransport =
  (filePath: string) =>
  (message: LogMessage, minimumLogLevel: LogLevel): void => {
    if (message.logLevel < minimumLogLevel) return;
    fs.appendFileSync(filePath, formatLogLine(message));
  };

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
