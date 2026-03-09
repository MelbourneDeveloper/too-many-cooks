/// Status tool - system overview.
library;

import 'package:dart_logging/dart_logging.dart';
import 'package:dart_node_mcp/dart_node_mcp.dart';
import 'package:nadz/nadz.dart';
import 'package:too_many_cooks/src/data/data.dart';
import 'package:too_many_cooks/src/types.dart';

/// Input schema for status tool (no inputs required).
const statusInputSchema = <String, Object?>{
  'type': 'object',
  'properties': <String, Object?>{},
};

/// Tool config for status.
const statusToolConfig = (
  title: 'Status',
  description: 'Get system overview: agents, locks, plans, messages',
  inputSchema: statusInputSchema,
  outputSchema: null,
  annotations: null,
);

/// Create status tool handler.
ToolCallback createStatusHandler(TooManyCooksDb db, Logger logger) =>
    (args, meta) async {
      final log = logger.child({'tool': 'status'});

      // Get agents
      final agentsResult = db.listAgents();
      if (agentsResult case Error(:final error)) {
        return _errorResult(error);
      }
      final String agents;
      switch (agentsResult) {
        case Success(:final value):
          agents = value.map(agentIdentityToJson).join(',');
        case Error(:final error):
          return _errorResult(error);
      }

      // Get locks
      final locksResult = db.listLocks();
      final String locks;
      switch (locksResult) {
        case Success(:final value):
          locks = value.map(fileLockToJson).join(',');
        case Error(:final error):
          return _errorResult(error);
      }

      // Get plans
      final plansResult = db.listPlans();
      final String plans;
      switch (plansResult) {
        case Success(:final value):
          plans = value.map(agentPlanToJson).join(',');
        case Error(:final error):
          return _errorResult(error);
      }

      // Get messages
      final messagesResult = db.listAllMessages();
      final String messages;
      switch (messagesResult) {
        case Success(:final value):
          messages = value.map(messageToJson).join(',');
        case Error(:final error):
          return _errorResult(error);
      }

      log.debug('Status queried');

      return (
        content: <Object>[
          textContent(
            '{"agents":[$agents],"locks":[$locks],'
            '"plans":[$plans],"messages":[$messages]}',
          ),
        ],
        isError: false,
      );
    };

CallToolResult _errorResult(DbError e) =>
    (content: <Object>[textContent(dbErrorToJson(e))], isError: true);
