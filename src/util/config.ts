import winston from "winston";
import { MongoClient, MongoError } from "mongodb";
import { Server } from "http";
import path from "path";
import fs from "fs";

import loggerConfig from "./logger";
import processTemplate, { Template } from "../templates";
import { EnvConfig } from "../metadata";

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

export const persistTemplate = async (input: Template): Promise<void> => {
  try {
    const template = await processTemplate(input);
    logger.debug("Generated '%s' from template file", template.outputFile);
  } catch (err1) {
    try {
      await fs.promises.access(input.outputFile, fs.constants.R_OK);
    } catch (err2) {
      logger.error(
        "Error while generating '%s' from template file: %s",
        input.outputFile,
        err1
      );
      logger.error("Cannot proceed due to error: %s", err2);

      process.exit(1);
    }
    // if the output file exists, then we are fine with continuing without
    logger.warn(
      "Could not generate '%s' from template file, but file already exists: %s",
      input.outputFile,
      err1
    );
  }
};

export const handleStartup = async (
  mongoUri: string,
  config: EnvConfig,
  targetUrl: string
): Promise<MongoClient> => {
  try {
    const { hostDir, publicDir } = config;
    await fs.promises.access(hostDir, fs.constants.R_OK | fs.constants.W_OK);
    if (!path.isAbsolute(hostDir)) {
      await Promise.reject("hostDir must be an absolute path");
    }

    const mongo = await MongoClient.connect(mongoUri, {
      useUnifiedTopology: true
    }).catch((err: MongoError) =>
      Promise.reject(err.message ?? "Unable to connect to database")
    );

    await persistTemplate({
      inputFile: path.join(publicDir, "templates", "bash.template"),
      outputFile: path.join(hostDir, "bash"),
      context: { TARGET_URL: targetUrl }
    } as Template);
    await persistTemplate({
      inputFile: path.join(publicDir, "templates", "index.html.template"),
      outputFile: path.join(hostDir, "index.html"),
      context: { TARGET_URL: targetUrl }
    } as Template);

    return mongo;
  } catch (err) {
    logger.error("Error occurred during startup: %s", err);
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
