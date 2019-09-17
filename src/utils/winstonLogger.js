const winston = require('winston');
const WinstonDailyRotateFile = require('winston-daily-rotate-file');
const moment = require('moment-timezone');
const config = require('config');

const serviceName = config.get('serviceName');

const winstonTransportConfig = {
  consoleConfig: {
    level: 'debug',
    handleExceptions: true,
  },
  fileRotateConfig: {
    level: 'info',
    filename: `${serviceName}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    dirname: `/var/log/${serviceName}`,
    maxSize: '20m',
    maxFiles: 14,
    handleExceptions: true,
  },
};

const timestampFormat = winston.format((info, opts) => {
  if (opts.tz) {
    // eslint-disable-next-line no-param-reassign
    info.timestamp = moment().tz(opts.tz).format('YYYY-MM-DDTHH:mm:ss.SSSZ');
  }
  return info;
});

const logLineFormat = winston.format.printf(info => `${info.timestamp} \
[${info.label.service}] \
${info.level.toUpperCase()}: ${info.message}`);

const format = winston.format.combine(
  winston.format.label({ label: { service: serviceName } }),
  timestampFormat({ tz: config.get('logTz') }),
  logLineFormat,
);
const winstonTransports = [];
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'beta') {
  winstonTransports.push(new WinstonDailyRotateFile(winstonTransportConfig.fileRotateConfig));
} else {
  winstonTransports.push(new winston.transports.Console(winstonTransportConfig.consoleConfig));
}

const winstonLogger = winston.createLogger({
  levels: winston.config.syslog.levels,
  transports: winstonTransports,
  format,
  exitOnError: false,
});

module.exports = winstonLogger;
