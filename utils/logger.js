const winston = require('winston');
require('winston-daily-rotate-file');
const fs = require('fs');
const path = require('path');

// Ensure the logs directory exists automatically
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Ensure the log level outputs in uppercase safely before colorization
const upperCaseLevelFormatter = winston.format((info) => {
  info.level = info.level.toUpperCase();
  return info;
});

// Custom Log Format Configured
const customFormat = winston.format.printf((info) => {
  const { timestamp, level, message, module, method, route, stack, ...meta } = info;
  
  const logModule = module ? `[${module}] ` : '';
  const logMethod = method ? `[${method}] ` : '';
  const logRoute = route ? `${route} - ` : '';

  // Clean meta from winston's internal symbols that clutter JSON serialization
  delete meta[Symbol.for('level')];
  delete meta[Symbol.for('message')];
  delete meta[Symbol.for('splat')];

  // Concatenate other metadata items
  const metaKeys = Object.keys(meta);
  const metaStr = metaKeys.length 
    ? ' | ' + metaKeys.map(k => `${k}: ${typeof meta[k] === 'object' ? JSON.stringify(meta[k]) : meta[k]}`).join(', ') 
    : '';

  // Append stack trace to entirely new lines if present
  const stackStr = stack ? `\nStack: ${stack}` : '';

  return `${timestamp} [${level}] ${logModule}${logMethod}${logRoute}${message}${metaStr}${stackStr}`;
});

// Configure Main Logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.errors({ stack: true }), 
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    upperCaseLevelFormatter(),
    customFormat
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json() // Proper JSON structure for errors
      )
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'info.log'),
      level: 'info', // logs info & above
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
    }),
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true, // Will compress older logs
    })
  ]
});

// Dev-only Console Transport with colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }), // Automatically colors level strings
      customFormat
    )
  }));
}

// Exception and Rejection Handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { stack: error.stack || error });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { stack: reason instanceof Error ? reason.stack : reason });
});

// Module-Based Child Loggers
const adminLogger = logger.child({ module: 'ADMIN' });
const userLogger  = logger.child({ module: 'USER' });
const marketingLogger = logger.child({ module: 'MARKETING' });

module.exports = {
  logger,
  adminLogger,
  userLogger,
  marketingLogger
};
