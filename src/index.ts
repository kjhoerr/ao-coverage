import dotenv from "dotenv";
import express from "express";
import winston from "winston";
import expressWinston from "express-winston";
import path from "path";

import routes from "./routes";
import Metadata, { EnvConfig } from "./metadata";
import loggerConfig from "./util/logger";
import {
  configOrError,
  handleStartup,
  handleShutdown,
  initializeToken,
} from "./config";

dotenv.config();

const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";
const logger = winston.createLogger(loggerConfig("ROOT", LOG_LEVEL));

// Application-wide configuration settings
const ENV_CONFIG: EnvConfig = {
  // Express configuration
  bindAddress: process.env.BIND_ADDRESS ?? "localhost",
  port: Number(process.env.PORT ?? 3000),
  uploadLimit: Number(process.env.UPLOAD_LIMIT ?? 4194304),

  // Database connection information
  dbName: process.env.MONGO_DB ?? "ao-coverage",
  dbUri: configOrError("MONGO_URI", logger),

  // Where the server should say it's located
  targetUrl: process.env.TARGET_URL ?? "http://localhost:3000",

  // Directories used for serving static or uploaded files
  publicDir: path.join(__dirname, "..", "public"),
  hostDir: configOrError("HOST_DIR", logger),

  // Application configuration
  token: process.env.TOKEN ?? initializeToken(logger),
  stage1: Number(process.env.STAGE_1 ?? 95),
  stage2: Number(process.env.STAGE_2 ?? 80),
  logLevel: LOG_LEVEL,
};

handleStartup(ENV_CONFIG, logger).then((mongo) => {
  const app: express.Application = express();
  const metadata = new Metadata(mongo.db(ENV_CONFIG.dbName), ENV_CONFIG);

  app.use(
    expressWinston.logger({
      ...loggerConfig("HTTP", ENV_CONFIG.logLevel),
      colorize: true,
      // filter out token query param from URL
      msg: '{{req.method}} {{req.url.replace(/token=[-\\w.~]*(&*)/, "token=$1")}} - {{res.statusCode}} {{res.responseTime}}ms',
    })
  );

  // actual app routes
  app.use(routes(metadata));

  app.use(expressWinston.errorLogger(loggerConfig("_ERR", ENV_CONFIG.logLevel)));

  const server = app.listen(ENV_CONFIG.port, ENV_CONFIG.bindAddress, () => {
    logger.info("Express has started: http://%s:%d/", ENV_CONFIG.bindAddress, ENV_CONFIG.port);
  });

  // application exit handling
  const signalCodes: NodeJS.Signals[] = ["SIGTERM", "SIGHUP", "SIGINT"];
  signalCodes.map((code: NodeJS.Signals) => {
    process.on(code, handleShutdown(mongo, server, logger));
  });
});
