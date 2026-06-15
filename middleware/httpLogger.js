const morgan = require('morgan');
const { logger, adminLogger, userLogger, marketingLogger } = require('../utils/logger');

// Dynamically extract logged-in user meta variables
morgan.token('userId', (req) => (req.user && (req.user.userId || req.user.id)) || 'Guest');
morgan.token('email', (req) => (req.user && req.user.email) || 'N/A');

const httpLogger = morgan(
  (tokens, req, res) => {
    // Return a JSON payload for smooth ingestion into winston's stream
    return JSON.stringify({
      method: tokens.method(req, res),
      route: tokens.url(req, res),
      status: tokens.status(req, res),
      responseTime: `${tokens['response-time'](req, res)}ms`,
      userId: tokens.userId(req, res),
      email: tokens.email(req, res),
      ip: tokens['remote-addr'](req, res)
    });
  },
  {
    stream: {
      write: (message) => {
        try {
          const meta = JSON.parse(message);
          const route = meta.route || '';
          
          // Auto-Route to the correct module's child logger
          let targetLogger = logger;
          if (route.includes('/api/admin') || route.includes('/admin')) targetLogger = adminLogger;
          else if (route.includes('/api/user') || route.includes('/user')) targetLogger = userLogger;
          else if (route.includes('/api/marketing') || route.includes('/marketing')) targetLogger = marketingLogger;
          else targetLogger = logger.child({ module: 'HTTP' });

          const statusCode = parseInt(meta.status, 10);
          
          // Determine the correct alert level 
          let level = 'info';
          if (statusCode >= 400 && statusCode < 500) level = 'warn';
          else if (statusCode >= 500) level = 'error';

          targetLogger.log(level, `HTTP Request Completed`, meta);
        } catch (e) {
          logger.info(message.trim(), { module: 'HTTP' });
        }
      }
    },
    skip: (req, res) => {
      const url = req.originalUrl || req.url;
      return url === '/health' || url === '/ping'; // Ignore pings
    }
  }
);

module.exports = httpLogger;
