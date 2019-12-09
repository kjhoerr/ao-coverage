import winston from "winston";
import handlebars from "handlebars";
import path from "path";
import fs from "fs";

import loggerConfig from "./util/logger";
import { configOrError } from "./util/config";

const logger = winston.createLogger(loggerConfig("TEMPLATE"));

const HOST_DIR = configOrError("HOST_DIR");
const TARGET_URL = process.env.TARGET_URL || "http://localhost:3000";

fs.promises
  .readFile(path.join(__dirname, "..", "public", "bash.template"), "utf-8")
  .then(buffer => {
    const translate = handlebars.compile(buffer);

    return {
      name: "bash",
      data: translate({ TARGET_URL })
    };
  })
  .then(file =>
    fs.promises
      .writeFile(path.join(HOST_DIR, file.name), file.data)
      .then(() => file)
  )
  .then(file => logger.debug("Generated '%s' from template file", file.name))
  .catch(err => logger.error("Error while generating template file: %s", err));
