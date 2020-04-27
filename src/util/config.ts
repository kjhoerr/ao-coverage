import winston from "winston";
import { MongoClient, MongoError } from "mongodb";
import { Server } from "http";
import path from "path";
import fs from "fs";

import loggerConfig from "./logger";
import processTemplate, { Template } from "../templates";

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

const MONGO_URI = configOrError("MONGO_URI");
const TARGET_URL = process.env.TARGET_URL ?? "http://localhost:3000";
const HOST_DIR = configOrError("HOST_DIR");

export const handleStartup = async (): Promise<MongoClient> => {
  try {
    await fs.promises.access(HOST_DIR, fs.constants.R_OK | fs.constants.W_OK);
    if (!path.isAbsolute(HOST_DIR)) {
      logger.error("HOST_DIR must be an absolute path");
      process.exit(1);
    }

    const mongo = await MongoClient.connect(MONGO_URI, {
      useUnifiedTopology: true
    }).catch((err: MongoError) => {
      logger.error(err.message ?? "Unable to connect to database");
      process.exit(1);
    });

    await persistTemplate({
      inputFile: path.join(
        __dirname,
        "..",
        "..",
        "public",
        "templates",
        "bash.template"
      ),
      outputFile: path.join(HOST_DIR, "bash"),
      context: { TARGET_URL }
    } as Template);
    await persistTemplate({
      inputFile: path.join(
        __dirname,
        "..",
        "..",
        "public",
        "templates",
        "index.html.template"
      ),
      outputFile: path.join(HOST_DIR, "index.html"),
      context: { TARGET_URL }
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
