import winston from "winston";
import { MongoClient } from "mongodb";
import { Server } from "http";

import logger_config from "./logger";

const logger = winston.createLogger(logger_config("ROOT"));

export const config_or_error = (var_name: string) => {
  if (!process.env[var_name]) {
    logger.error("%s must be defined", var_name);
    process.exit(1);
    return "";
  } else {
    return process.env[var_name] || "";
  }
};

export const handle_shutdown = (mongo: MongoClient, server: Server) => (
  signal: NodeJS.Signals
) => {
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
