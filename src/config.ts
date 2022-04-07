import winston from "winston";
import { MongoClient, MongoError } from "mongodb";
import { Server } from "http";
import path from "path";
import fs from "fs";

import processTemplate, { Template } from "./templates";
import Metadata, { EnvConfig } from "./metadata";

/**
 * Get environment variable or exit application if it doesn't exist
 */
export const configOrError = (
  varName: string,
  logger: winston.Logger
): string => {
  const value = process.env[varName];
  if (value !== undefined) {
    return value;
  } else {
    logger.error("%s must be defined", varName);
    process.exit(1);
  }
};

/**
 * Process a template and persist based on template.
 */
export const persistTemplate = async (
  input: Template,
  logger: winston.Logger
): Promise<void> => {
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

/**
 * Handle server start-up functions:
 *
 * - Open database connection
 * - Generate documents from templates based on configuration
 *
 * If one of these actions cannot be performed, it will call `process.exit(1)`.
 */
export const handleStartup = async (
  config: EnvConfig,
  token: string | undefined,
  logger: winston.Logger
): Promise<Metadata> => {
  try {
    const { hostDir, publicDir, dbUri, targetUrl } = config;
    await fs.promises.access(hostDir, fs.constants.R_OK | fs.constants.W_OK);
    if (!path.isAbsolute(hostDir)) {
      await Promise.reject("hostDir must be an absolute path");
    }

    const mongo = await MongoClient.connect(dbUri).catch((err: MongoError) =>
      Promise.reject(err.message ?? "Unable to connect to database")
    );

    await persistTemplate(
      {
        inputFile: path.join(publicDir, "templates", "sh.tmpl"),
        outputFile: path.join(hostDir, "sh"),
        context: { TARGET_URL: targetUrl },
      } as Template,
      logger
    );
    await persistTemplate(
      {
        inputFile: path.join(publicDir, "templates", "index.html.tmpl"),
        outputFile: path.join(hostDir, "index.html"),
        context: {
          TARGET_URL: targetUrl,
          CURL_HTTPS: targetUrl.includes("https")
            ? "--proto '=https' --tlsv1.2 "
            : "",
        },
      } as Template,
      logger
    );

    const metadata = new Metadata(mongo, config);

    await metadata.initializeToken(token);

    return metadata;
  } catch (err) {
    logger.error("Error occurred during startup: %s", err);
    process.exit(1);
  }
};

/**
 * Callback for NodeJS `process.on()` to handle shutdown signals
 * and close open connections.
 */
export const handleShutdown =
  (metadata: Metadata, server: Server, logger: winston.Logger) =>
  async (signal: NodeJS.Signals): Promise<void> => {
    logger.warn("%s signal received. Closing shop.", signal);

    try {
      await metadata.close();

      // must await for callback - wrapped in Promise
      await new Promise((res, rej) =>
        server.close((err) => {
          logger.info("Express down.");
          (err ? rej : res)(err);
        })
      );

      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  };
