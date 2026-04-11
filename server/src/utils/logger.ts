import winston from 'winston';

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

// Development format: TIME [LEVEL]: message {meta}
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Production format: JSON structured logging
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const transports: winston.transport[] = [
  new winston.transports.Console(),
];

if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    })
  );
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: isProduction ? prodFormat : devFormat,
  transports,
});
