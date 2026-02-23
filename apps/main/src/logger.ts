import log from 'electron-log';

// Send all renderer-process logs through the same file logger
log.transports.file.level = 'info';
log.transports.console.level = process.env['NODE_ENV'] === 'development' ? 'debug' : 'warn';

export const logger = {
  debug: (...args: unknown[]) => log.debug(...args),
  info: (...args: unknown[]) => log.info(...args),
  warn: (...args: unknown[]) => log.warn(...args),
  error: (...args: unknown[]) => log.error(...args),
};
