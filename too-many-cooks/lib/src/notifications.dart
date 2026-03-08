/// Notification system for push-based updates.
///
/// All events are pushed automatically to every connected client
/// (agents + VSIX). There is no subscribe tool — subscriptions
/// are managed entirely by the server based on connection state.
///
/// Agents receive notifications via MCP logging messages on their
/// Streamable HTTP session. This is CRITICAL — agents must know
/// about new messages, lock changes, and agent status in
/// real-time without polling.
library;

import 'dart:async';

import 'package:dart_node_core/dart_node_core.dart';
import 'package:dart_node_mcp/dart_node_mcp.dart';

/// Event type for agent registration.
const eventAgentRegistered = 'agent_registered';

/// Event type for agent activation (reconnect).
const eventAgentActivated = 'agent_activated';

/// Event type for agent deactivation (disconnect).
const eventAgentDeactivated = 'agent_deactivated';

/// Event type for lock acquisition.
const eventLockAcquired = 'lock_acquired';

/// Event type for lock release.
const eventLockReleased = 'lock_released';

/// Event type for lock renewal.
const eventLockRenewed = 'lock_renewed';

/// Event type for message sent.
const eventMessageSent = 'message_sent';

/// Event type for plan update.
const eventPlanUpdated = 'plan_updated';

/// Logger name for agent notifications.
const agentLoggerName = 'too-many-cooks';

/// Callback type for pushing events.
typedef EventPushFn =
    void Function(String event, Map<String, Object?> payload);

/// Agent event hub — tracks all connected agent McpServer
/// instances and pushes notifications to them in real-time.
typedef AgentEventHub = ({
  Map<String, McpServer> servers,
  void Function(String event, Map<String, Object?> payload)
      pushEvent,
});

/// Create an agent event hub for pushing real-time
/// notifications to all connected agents.
AgentEventHub createAgentEventHub() {
  final servers = <String, McpServer>{};

  void pushEvent(
    String event,
    Map<String, Object?> payload,
  ) {
    consoleError(
      '[TMC] [AGENT-PUSH] $event → '
      '${servers.length} agent(s)',
    );
    final data = <String, Object?>{
      'event': event,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'payload': payload,
    };

    for (final entry in [...servers.entries]) {
      consoleError(
        '[TMC] [AGENT-PUSH] Sending to ${entry.key}',
      );
      unawaited(
        entry.value
            .sendLoggingMessage((
              level: 'info',
              logger: agentLoggerName,
              data: data,
            ))
            .then((_) {
              consoleError(
                '[TMC] [AGENT-PUSH] Sent OK to '
                '${entry.key}',
              );
            }, onError: (Object e) {
              consoleError(
                '[TMC] [AGENT-PUSH] FAILED '
                '${entry.key}: $e',
              );
              servers.remove(entry.key);
            }),
      );
    }
  }

  return (servers: servers, pushEvent: pushEvent);
}

/// Notification emitter — broadcasts events to all connected
/// clients via MCP logging. No subscriber management.
typedef NotificationEmitter = ({
  void Function(String event, Map<String, Object?> payload) emit,
});

/// Create a notification emitter that pushes to both the
/// agent event hub and the admin event hub.
///
/// Both pushes are deferred by 50ms so the tool-call HTTP
/// response is flushed before the notification arrives on
/// the same Streamable HTTP session.
NotificationEmitter createNotificationEmitter(
  McpServer server, {
  EventPushFn? adminPush,
  EventPushFn? agentPush,
}) {
  void emit(String event, Map<String, Object?> payload) {
    // Deferred to next event-loop tick so the tool-call HTTP
    // response is flushed before the push arrives.
    // Without this, the push can beat the response and
    // clients parse a notification instead of their tool
    // result.
    Timer(const Duration(milliseconds: 50), () {
      adminPush?.call(event, payload);
      agentPush?.call(event, payload);
    });
  }

  return (emit: emit,);
}
