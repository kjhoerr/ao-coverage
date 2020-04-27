import dotenv from "dotenv";
import express from "express";
import winston from "winston";
import expressWinston from "express-winston";

dotenv.config();

import routes from "./routes";
import Metadata from "./metadata";
import loggerConfig from "./util/logger";
import { handleStartup, handleShutdown } from "./util/config";

// Start-up configuration
const BIND_ADDRESS = process.env.BIND_ADDRESS ?? "localhost";
const MONGO_DB = process.env.MONGO_DB ?? "ao-coverage";
const PORT = Number(process.env.PORT ?? 3000);

const logger = winston.createLogger(loggerConfig("ROOT"));

handleStartup().then(mongo => {
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
});
