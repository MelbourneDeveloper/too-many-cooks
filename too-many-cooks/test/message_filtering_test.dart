/// Regression test: message_sent notifications must only be delivered
/// to the recipient agent, not to all agents.
///
/// Bug: currently emitter.emit(eventMessageSent, ...) broadcasts to ALL
/// agents regardless of who the message is addressed to.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:dart_node_core/dart_node_core.dart';
import 'package:dart_node_coverage/dart_node_coverage.dart';
import 'package:test/test.dart';
import 'package:too_many_cooks/too_many_cooks.dart' show serverBinary;

const _baseUrl = 'http://localhost:4040';
const _mcpPath = '/mcp';
const _accept = 'application/json, text/event-stream';
const _mcpProtocolVersion = '2025-03-26';
const _streamEstablishDelayMs = 300;
const _eventTimeoutMs = 1500;
const _eventPollDelayMs = 50;
const _dbDir = '.too_many_cooks';
const _dbFiles = ['data.db', 'data.db-wal', 'data.db-shm'];

@JS('globalThis.fetch')
external JSPromise<JSObject> _jsFetch(JSString url, [JSObject? options]);

void main() {
  tearDownAll(() => writeCoverageFile('coverage/coverage.json'));
  // `late` needed: assigned in setUpAll, used across multiple test callbacks.
  // ignore: no_late, reason: needed across multiple test callbacks
  late JSObject serverProcess;

  setUpAll(() async {
    _deleteDbFiles();
    serverProcess = _spawnServer();
    await _waitForServer();
  });

  tearDownAll(() {
    _killProcess(serverProcess);
    _deleteDbFiles();
  });

  setUp(_resetServer);

  test(
    'message_sent is NOT delivered to agent that is not the recipient',
    () async {
      // Three agents: sender, recipient, bystander.
      // sender sends to recipient.
      // bystander MUST NOT receive the message_sent notification.
      final sender = _McpClient();
      final recipient = _McpClient();
      final bystander = _McpClient();
      await sender.initSession();
      await recipient.initSession();
      await bystander.initSession();

      final senderReg = _parseJson(
        await sender.callTool('register', {'name': 'sender'}),
      );
      await recipient.callTool('register', {'name': 'recipient'});
      await bystander.callTool('register', {'name': 'bystander'});

      final senderKey = senderReg['agent_key']! as String;

      // Open SSE streams AFTER registration to avoid buffered events.
      final recipientSse = await _AgentSseClient.connect(recipient.sessionId);
      final bystanderSse = await _AgentSseClient.connect(bystander.sessionId);

      // Send a message from sender to recipient only.
      await sender.callTool('message', {
        'action': 'send',
        'agent_key': senderKey,
        'to_agent': 'recipient',
        'content': 'hello recipient',
      });

      final recipientEvents = await recipientSse.waitForEvents(1);
      final bystanderEvents = await bystanderSse.waitForEvents(1);

      recipientSse.close();
      bystanderSse.close();

      // Recipient MUST get a message_sent notification.
      expect(
        recipientEvents.isNotEmpty,
        isTrue,
        reason: 'recipient MUST receive message_sent notification',
      );
      final recipientEventType = _extractEventType(recipientEvents.first);
      expect(
        recipientEventType,
        equals('message_sent'),
        reason: 'recipient event type MUST be message_sent',
      );

      // Bystander MUST NOT get any message_sent notification.
      final bystanderMessageEvents = bystanderEvents
          .where((e) => _extractEventType(e) == 'message_sent')
          .toList();
      expect(
        bystanderMessageEvents.isEmpty,
        isTrue,
        reason:
            'bystander MUST NOT receive message_sent for a message '
            'not addressed to them',
      );
    },
  );

  test(
    'broadcast message_sent (* recipient) IS delivered to all agents',
    () async {
      final sender = _McpClient();
      final agent2 = _McpClient();
      await sender.initSession();
      await agent2.initSession();

      final senderReg = _parseJson(
        await sender.callTool('register', {'name': 'sender-b'}),
      );
      await agent2.callTool('register', {'name': 'agent2-b'});

      final senderKey = senderReg['agent_key']! as String;

      final agent2Sse = await _AgentSseClient.connect(agent2.sessionId);

      await sender.callTool('message', {
        'action': 'send',
        'agent_key': senderKey,
        'to_agent': '*',
        'content': 'broadcast!',
      });

      final events = await agent2Sse.waitForEvents(1);
      agent2Sse.close();

      expect(
        events.isNotEmpty,
        isTrue,
        reason: 'agent2 MUST receive broadcast message_sent',
      );
      expect(
        _extractEventType(events.first),
        equals('message_sent'),
        reason: 'event type MUST be message_sent',
      );
    },
  );
}

// ============================================================
// Helpers
// ============================================================

Map<String, Object?> _parseJson(String text) =>
    jsonDecode(text) as Map<String, Object?>;

String? _extractEventType(String sseData) {
  final json = _parseJson(sseData);
  final params = json['params'] as Map<String, Object?>?;
  final data = params?['data'] as Map<String, Object?>?;
  return data?['event'] as String?;
}

class _AgentSseClient {
  _AgentSseClient._();

  final _events = <String>[];
  var _consumed = 0;
  _SseReader? _reader;

  static Future<_AgentSseClient> connect(String sessionId) async {
    final client = _AgentSseClient._();
    client._reader = await _SseReader.open(
      '$_baseUrl$_mcpPath',
      sessionId,
      client._events,
    );
    await Future<void>.delayed(
      const Duration(milliseconds: _streamEstablishDelayMs),
    );
    return client;
  }

  Future<List<String>> waitForEvents(
    int count, {
    int timeoutMs = _eventTimeoutMs,
  }) async {
    final start = DateTime.now().millisecondsSinceEpoch;
    while (DateTime.now().millisecondsSinceEpoch - start < timeoutMs) {
      if (_events.length - _consumed >= count) {
        final result = _events.sublist(_consumed);
        _consumed = _events.length;
        return result;
      }
      await Future<void>.delayed(
        const Duration(milliseconds: _eventPollDelayMs),
      );
    }
    final result = _events.sublist(_consumed);
    _consumed = _events.length;
    return result;
  }

  void close() => _reader?.abort();
}

class _SseReader {
  _SseReader._(this._controller);

  final JSObject _controller;
  static const _dataPrefix = 'data: ';

  static Future<_SseReader> open(
    String url,
    String sessionId,
    List<String> events,
  ) async {
    final controller = _createAbortController();
    final signal = controller['signal']!;
    final headers = JSObject()
      ..['Accept'] = _accept.toJS
      ..['mcp-session-id'] = sessionId.toJS;
    final options = JSObject()
      ..['method'] = 'GET'.toJS
      ..['headers'] = headers
      ..['signal'] = signal;

    unawaited(
      Future<void>(() async {
        try {
          final response = await _jsFetch(url.toJS, options).toDart;
          final ok = response['ok'] as JSBoolean?;
          if (ok == null || !ok.toDart) return;
          final body = response['body'];
          if (body == null || body.isUndefinedOrNull) return;
          final reader =
              ((body as JSObject)['getReader']! as JSFunction).callAsFunction(
                    body,
                  )!
                  as JSObject;
          final decoder = _createTextDecoder();
          var buffer = '';
          for (;;) {
            final chunk =
                await ((reader['read']! as JSFunction).callAsFunction(reader)!
                        as JSPromise<JSObject>)
                    .toDart;
            final done = chunk['done'] as JSBoolean?;
            if (done != null && done.toDart) break;
            final value = chunk['value'];
            if (value == null || value.isUndefinedOrNull) continue;
            final decoded =
                (decoder['decode']! as JSFunction).callAsFunction(
                      decoder,
                      value,
                      _streamOptions,
                    )!
                    as JSString;
            final sb = StringBuffer(buffer)..write(decoded.toDart);
            buffer = sb.toString();
            final lines = buffer.split('\n');
            buffer = lines.removeLast();
            for (final line in lines) {
              if (line.startsWith(_dataPrefix)) {
                final data = line.substring(_dataPrefix.length).trim();
                if (data.isNotEmpty) events.add(data);
              }
            }
          }
        } on Object {
          // aborted — expected
        }
      }),
    );

    return _SseReader._(controller);
  }

  void abort() {
    (_controller['abort']! as JSFunction).callAsFunction(_controller);
  }
}

@JS('globalThis.AbortController')
external JSFunction get _abortControllerCtor;

JSObject _createAbortController() =>
    _abortControllerCtor.callAsConstructor<JSObject>();

@JS('globalThis.TextDecoder')
external JSFunction get _textDecoderCtor;

JSObject _createTextDecoder() => _textDecoderCtor.callAsConstructor<JSObject>();

final JSObject _streamOptions = JSObject()..['stream'] = true.toJS;

class _McpClient {
  String _sessionId = '';
  var _nextId = 1;

  String get sessionId {
    if (_sessionId.isEmpty) {
      throw StateError('Session not initialized');
    }
    return _sessionId;
  }

  Future<void> initSession() async {
    await _request('initialize', {
      'protocolVersion': _mcpProtocolVersion,
      'capabilities': <String, Object?>{},
      'clientInfo': {'name': 'msg-filter-test', 'version': '1.0'},
    });
    if (_sessionId.isEmpty) {
      throw StateError('No session ID after init');
    }
    await _postMcp(
      jsonEncode({
        'jsonrpc': '2.0',
        'method': 'notifications/initialized',
        'params': <String, Object?>{},
      }),
    );
  }

  Future<String> callTool(String name, Map<String, Object?> args) async {
    final result = await _request('tools/call', {
      'name': name,
      'arguments': args,
    });
    final content = (result['content']! as List).first as Map<String, Object?>;
    return content['text']! as String;
  }

  Future<Map<String, Object?>> _request(
    String method,
    Map<String, Object?> params,
  ) async {
    final body = jsonEncode({
      'jsonrpc': '2.0',
      'id': _nextId++,
      'method': method,
      'params': params,
    });
    final response = await _postMcp(body);
    final text = await _responseText(response);
    final json = _parseMcpResponse(text);
    if (json.containsKey('error')) {
      final msg =
          (json['error']! as Map<String, Object?>)['message'] as String? ??
          'Error';
      return {
        'isError': true,
        'content': [
          {'type': 'text', 'text': msg},
        ],
      };
    }
    return json['result']! as Map<String, Object?>;
  }

  Future<JSObject> _postMcp(String body) async {
    final headers = JSObject()
      ..['Content-Type'] = 'application/json'.toJS
      ..['Accept'] = _accept.toJS;
    if (_sessionId.isNotEmpty) {
      headers['mcp-session-id'] = _sessionId.toJS;
    }
    final options = JSObject()
      ..['method'] = 'POST'.toJS
      ..['headers'] = headers
      ..['body'] = body.toJS;
    final response = await _jsFetch('$_baseUrl$_mcpPath'.toJS, options).toDart;
    final headers2 = response['headers'] as JSObject?;
    if (headers2 != null) {
      final getFn = headers2['get'] as JSFunction?;
      final sid = getFn?.callAsFunction(headers2, 'mcp-session-id'.toJS);
      if (sid != null && !sid.isUndefinedOrNull) {
        _sessionId = (sid as JSString).toDart;
      }
    }
    return response;
  }

  Future<String> _responseText(JSObject response) async {
    final text =
        await ((response['text'] as JSFunction?)?.callAsFunction(response)
                as JSPromise<JSString>?)
            ?.toDart;
    return text?.toDart ?? '';
  }

  Map<String, Object?> _parseMcpResponse(String text) {
    if (text.trimLeft().startsWith('{')) {
      return jsonDecode(text) as Map<String, Object?>;
    }
    for (final line in text.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          return jsonDecode(line.substring(6)) as Map<String, Object?>;
        } on Object {
          continue;
        }
      }
    }
    throw StateError('Could not parse: $text');
  }
}

JSObject _spawnServer() {
  final childProcess = requireModule('child_process') as JSObject;
  final spawnFn = childProcess['spawn']! as JSFunction;
  return spawnFn.callAsFunction(
        null,
        'node'.toJS,
        <String>[serverBinary].jsify(),
        <String, Object?>{
          'stdio': ['pipe', 'pipe', 'inherit'],
        }.jsify(),
      )!
      as JSObject;
}

void _killProcess(JSObject process) {
  (process['kill']! as JSFunction).callAsFunction(process);
}

Future<void> _waitForServer() async {
  for (var i = 0; i < 30; i++) {
    try {
      final r = await _jsFetch('$_baseUrl/admin/status'.toJS).toDart;
      final ok = r['ok'] as JSBoolean?;
      if (ok != null && ok.toDart) return;
    } on Object {
      // not ready
    }
    if (i == 29) throw StateError('Server failed to start');
    await Future<void>.delayed(const Duration(milliseconds: 200));
  }
}

Future<void> _resetServer() async {
  final options = JSObject()
    ..['method'] = 'POST'.toJS
    ..['headers'] = (JSObject()..['Content-Type'] = 'application/json'.toJS);
  final r = await _jsFetch('$_baseUrl/admin/reset'.toJS, options).toDart;
  final ok = r['ok'] as JSBoolean?;
  if (ok == null || !ok.toDart) {
    throw StateError('Failed to reset server');
  }
}

void _deleteDbFiles() {
  final fs = requireModule('fs') as JSObject;
  final unlinkSync = fs['unlinkSync']! as JSFunction;
  final existsSync = fs['existsSync']! as JSFunction;
  for (final file in _dbFiles) {
    final path = '$_dbDir/$file';
    final exists =
        (existsSync.callAsFunction(fs, path.toJS) as JSBoolean?)?.toDart ??
        false;
    if (exists) unlinkSync.callAsFunction(fs, path.toJS);
  }
}
