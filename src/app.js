require('app-module-path').addPath(require('path').resolve(__dirname, '..'));
require('dotenv-safe').config();

const express = require('express');
const boolParser = require('express-query-boolean');
const config = require('config'); 
const gracefulShutdown = require('http-graceful-shutdown');

const logger = require('src/utils/logger');
const winstonLogger = require('src/utils/winstonLogger');
const routes = require('src/routes');

const app = express();

app.set('port', process.env.PORT);

// Production hardening
app.disable('x-powered-by');

// Request Body Parsing
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));

// Request query parameter - boolean parsing
app.use(boolParser());

app.use('/', routes);

const server = app.listen(app.get('port'), () => {
  logger.info(`${config.get('serviceName')} is running on port ${app.get('port')}`);
});

const shutdownCleanup = async (signal) => {
  logger.info(`Received ${signal}, shutting down...`);
  const loggerDone = new Promise(resolve => winstonLogger.on('finish', resolve));
  winstonLogger.end();

  return loggerDone;
};

gracefulShutdown(server, { onShutdown: shutdownCleanup, timeout: 5000 });
