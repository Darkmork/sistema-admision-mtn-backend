const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'notification-service' },
  transports: [
    new winston.transports.File({ filename: path.join(process.env.LOG_DIR || './logs', 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 5 }),
    new winston.transports.File({ filename: path.join(process.env.LOG_DIR || './logs', 'combined.log'), maxsize: 5242880, maxFiles: 5 })
  ],
  exceptionHandlers: [new winston.transports.File({ filename: path.join(process.env.LOG_DIR || './logs', 'exceptions.log') })],
  rejectionHandlers: [new winston.transports.File({ filename: path.join(process.env.LOG_DIR || './logs', 'rejections.log') })]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.simple())
  }));
}

module.exports = logger;
