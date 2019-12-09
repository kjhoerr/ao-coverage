import dotenv from "dotenv";
import express from "express";
import { MongoClient } from "mongodb";
import path from "path";
import fs from "fs";

import winston from "winston";
import expressWinston from "express-winston";

dotenv.config();

import routes from "./routes";
import Metadata from "./metadata";
import loggerConfig from "./util/logger";
import { configOrError, handleShutdown } from "./util/config";

// Start-up configuration
const BIND_ADDRESS = process.env.BIND_ADDRESS || "localhost";
const PORT = Number(process.env.PORT || 3000);

const logger = winston.createLogger(loggerConfig("ROOT"));

const MONGO_URI = configOrError("MONGO_URI");
const MONGO_DB = process.env.MONGO_DB || "ao-coverage";
const HOST_DIR = configOrError("HOST_DIR");

fs.accessSync(HOST_DIR, fs.constants.R_OK | fs.constants.W_OK);
if (!path.isAbsolute(HOST_DIR)) {
  logger.error("HOST_DIR must be an absolute path");
  process.exit(1);
}

// prepare template files
require("./templates");

new MongoClient(MONGO_URI, { useUnifiedTopology: true }).connect(
  (err, mongo) => {
    if (err !== null) {
      logger.error(err);
      process.exit(1);
    }

    const app: express.Application = express();
    const metadata = new Metadata(mongo.db(MONGO_DB));

    app.use(
      expressWinston.logger({
        ...loggerConfig("HTTP"),
        colorize: true,
        // filter out token query param from URL
        msg:
          '{{req.method}} {{req.url.replace(/token=[-\\w.~]*(&*)/, "token=$1")}} - {{res.statusCode}} {{res.responseTime}}ms'
      })
    );

    // actual app routes
    app.use(routes(metadata));

    app.use(expressWinston.errorLogger(loggerConfig("_ERR")));

    const server = app.listen(PORT, BIND_ADDRESS, () => {
      logger.info("Express has started: http://%s:%d/", BIND_ADDRESS, PORT);
    });

    // application exit handling
    const signalCodes: NodeJS.Signals[] = ["SIGTERM", "SIGHUP", "SIGINT"];
    signalCodes.map((code: NodeJS.Signals) => {
      process.on(code, handleShutdown(mongo, server));
    });
  }
);
