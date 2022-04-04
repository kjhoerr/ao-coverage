import winston from "winston";
import { Format } from "logform";
import * as Transport from "winston-transport";
const { combine, splat, timestamp, label, colorize, printf } = winston.format;
const { Console } = winston.transports;

// Standard console message formatting
const consoleFormat = combine(
  colorize(),
  printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
  })
);

/**
 * Provides standard logging format and output for the server.
 */
const loggerConfig = (
  clazz: string,
  level: string
): {
  format: Format;
  transports: Transport[];
} => ({
  format: combine(splat(), timestamp(), label({ label: clazz })),
  transports: [new Console({ level: level, format: consoleFormat })],
});

export default loggerConfig;
