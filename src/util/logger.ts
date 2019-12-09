import winston from "winston";
import { Format } from "logform";
import * as Transport from "winston-transport";
const { combine, splat, timestamp, label, colorize, printf } = winston.format;
const { Console } = winston.transports;

const LOG_LEVEL = process.env.LOG_LEVEL || "info";

/**
 * Provides standard logging format and output for the server.
 */
export default (
  clazz: string,
  level: string = LOG_LEVEL
): {
  format: Format;
  transports: Transport[];
} => ({
  format: combine(
    splat(),
    timestamp(),
    label({ label: clazz }),
    colorize(),
    printf(({ level, message, label, timestamp }) => {
      return `${timestamp} [${label}] ${level}: ${message}`;
    })
  ),
  transports: [new Console({ level: level })]
});
