import dotenv from "dotenv";
import express from "express";
import winston from "winston";
import expressWinston from "express-winston";
import path from "path";

dotenv.config();

import routes from "./routes";
import Metadata, { EnvConfig } from "./metadata";
import loggerConfig from "./util/logger";
import { configOrError, handleStartup, handleShutdown } from "./util/config";

// Start-up configuration
const BIND_ADDRESS = process.env.BIND_ADDRESS ?? "localhost";
const MONGO_DB = process.env.MONGO_DB ?? "ao-coverage";
const PORT = Number(process.env.PORT ?? 3000);
const MONGO_URI = configOrError("MONGO_URI");
const TARGET_URL = process.env.TARGET_URL ?? "http://localhost:3000";
const ENV_CONFIG: EnvConfig = {
  token: process.env.TOKEN ?? "",
  uploadLimit: Number(process.env.UPLOAD_LIMIT ?? 4194304),
  publicDir: path.join(__dirname, "..", "public"),
  hostDir: configOrError("HOST_DIR")
};

const logger = winston.createLogger(loggerConfig("ROOT"));

handleStartup(MONGO_URI, ENV_CONFIG, TARGET_URL).then(mongo => {
  const app: express.Application = express();
  const metadata = new Metadata(mongo.db(MONGO_DB), ENV_CONFIG);

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
});
