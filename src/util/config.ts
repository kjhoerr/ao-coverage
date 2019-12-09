import winston from "winston";
import { MongoClient } from "mongodb";
import { Server } from "http";

import loggerConfig from "./logger";

const logger = winston.createLogger(loggerConfig("ROOT"));

export const configOrError = (varName: string): string => {
  if (!process.env[varName]) {
    logger.error("%s must be defined", varName);
    process.exit(1);
    return "";
  } else {
    return process.env[varName] || "";
  }
};

export const handleShutdown = (mongo: MongoClient, server: Server) => (
  signal: NodeJS.Signals
): void => {
  logger.warn("%s signal received. Closing shop.", signal);

  mongo
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
    .finally(() => {
      process.exit(0);
    });
};
