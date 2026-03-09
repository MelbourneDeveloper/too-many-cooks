/// Logger - replaces dart_logging package.

/** Log levels in order of severity. */
export const enum LogLevel {
  trace = 0,
  debug = 1,
  info = 2,
  warn = 3,
  error = 4,
  fatal = 5,
}

/** Structured log message. */
export type LogMessage = {
  readonly logLevel: LogLevel;
  readonly message: string;
  readonly structuredData: Record<string, unknown> | undefined;
  readonly timestamp: Date;
};

/** Log level names for display. */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.trace]: "TRACE",
  [LogLevel.debug]: "DEBUG",
  [LogLevel.info]: "INFO",
  [LogLevel.warn]: "WARN",
  [LogLevel.error]: "ERROR",
  [LogLevel.fatal]: "FATAL",
};

/** Get display name for a log level. */
export const logLevelName = (level: LogLevel): string => LOG_LEVEL_NAMES[level];

/** Log transport function. */
export type LogFunction = (
  message: LogMessage,
  minimumLogLevel: LogLevel,
) => void;

/** Logger interface. */
export type Logger = {
  readonly trace: (
    message: string,
    structuredData?: Record<string, unknown>,
  ) => void;
  readonly debug: (
    message: string,
    structuredData?: Record<string, unknown>,
  ) => void;
  readonly info: (
    message: string,
    structuredData?: Record<string, unknown>,
  ) => void;
  readonly warn: (
    message: string,
    structuredData?: Record<string, unknown>,
  ) => void;
  readonly error: (
    message: string,
    structuredData?: Record<string, unknown>,
  ) => void;
  readonly fatal: (
    message: string,
    structuredData?: Record<string, unknown>,
  ) => void;
  readonly child: (context: Record<string, unknown>) => Logger;
};

/** Logging context configuration. */
export type LoggingContext = {
  readonly transports: readonly LogFunction[];
  readonly minimumLogLevel: LogLevel;
};

/** Create a logging context. */
export const createLoggingContext = (
  options: {
    transports?: readonly LogFunction[];
    minimumLogLevel?: LogLevel;
  } = {},
): LoggingContext => ({
  transports: options.transports ?? [],
  minimumLogLevel: options.minimumLogLevel ?? LogLevel.debug,
});

/** Wrap a log function as a transport. */
export const logTransport = (fn: LogFunction): LogFunction => fn;

/** Create a logger from a context. */
export const createLoggerWithContext = (context: LoggingContext): Logger =>
  createLoggerImpl(context, {});

const createLoggerImpl = (
  context: LoggingContext,
  parentData: Record<string, unknown>,
): Logger => {
  const emit = (
    level: LogLevel,
    message: string,
    structuredData?: Record<string, unknown>,
  ): void => {
    const merged =
      Object.keys(parentData).length > 0 || structuredData !== undefined
        ? { ...parentData, ...structuredData }
        : undefined;
    const msg: LogMessage = {
      logLevel: level,
      message,
      structuredData: merged,
      timestamp: new Date(),
    };
    for (const transport of context.transports) {
      transport(msg, context.minimumLogLevel);
    }
  };

  return {
    trace: (msg, data) => emit(LogLevel.trace, msg, data),
    debug: (msg, data) => emit(LogLevel.debug, msg, data),
    info: (msg, data) => emit(LogLevel.info, msg, data),
    warn: (msg, data) => emit(LogLevel.warn, msg, data),
    error: (msg, data) => emit(LogLevel.error, msg, data),
    fatal: (msg, data) => emit(LogLevel.fatal, msg, data),
    child: (childData) =>
      createLoggerImpl(context, { ...parentData, ...childData }),
  };
};
