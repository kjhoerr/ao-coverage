import winston from "winston";
import { MongoClient } from "mongodb";
import { Server } from "http";

import loggerConfig from "./logger";

const logger = winston.createLogger(loggerConfig("ROOT"));

export const configOrError = (varName: string): string => {
  const value = process.env[varName];
  if (value !== undefined) {
    return value;
  } else {
    logger.error("%s must be defined", varName);
    process.exit(1);
  }
};

export const handleShutdown = (mongo: MongoClient, server: Server) => (
  signal: NodeJS.Signals
): Promise<void> => {
  logger.warn("%s signal received. Closing shop.", signal);

  return mongo
    .close()
    .then(() => {
      logger.info("MongoDB client connection closed.");
      return new Promise((res, rej) =>
        server.close(err => {
          logger.info("Express down.");
          (err ? rej : res)(err);
        })
      );
    })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
};
