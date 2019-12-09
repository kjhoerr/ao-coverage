import express from "express";
import { JSDOM } from "jsdom";
import { badgen } from "badgen";
import winston from "winston";
import path from "path";
import fs from "fs";

import formats, { GradientStyle } from "./formats";
import Metadata, { HeadIdentity } from "./metadata";
import { config_or_error } from "./util/config";
import logger_config from "./util/logger";
import { Messages } from "./errors";

const TOKEN = process.env.TOKEN || "";
const UPLOAD_LIMIT = Number(process.env.UPLOAD_LIMIT || 4194304);
const HOST_DIR = config_or_error("HOST_DIR");

const logger = winston.createLogger(logger_config("HTTP"));

export default (metadata: Metadata) => {
  const router = express.Router();

  // Upload HTML file
  router.post("/v1/:org/:repo/:branch/:commit.html", (req, res) => {
    const { org, repo, branch, commit } = req.params;

    const { token, format } = req.query;
    //TODO @Metadata token should come from metadata
    if (token != TOKEN) {
      return res.status(401).send(Messages.InvalidToken);
    }

    if (!formats.list_formats().includes(format)) {
      return res.status(406).send(Messages.InvalidFormat);
    }

    var contents = "";
    req.on("data", raw => {
      if (contents.length + raw.length > UPLOAD_LIMIT) {
        res.status(413).send(Messages.FileTooLarge);
      } else {
        contents += raw;
      }
    });
    req.on("end", () => {
      let coverage: number;
      const doc = new JSDOM(contents).window.document;
      const formatter = formats.get_format(format);
      const result = formatter.parse_coverage(doc);
      if (typeof result === "number") {
        coverage = result;
      } else {
        return res.status(400).send(result.message);
      }

      const report_path = path.join(HOST_DIR, org, repo, branch, commit);

      fs.promises
        .mkdir(report_path, { recursive: true })
        .then(
          () =>
            //TODO @Metadata stage values should come from metadata
            new Promise<GradientStyle>(solv =>
              solv({ stage_1: 95, stage_2: 80 })
            )
        )
        .then(
          style =>
            new Promise(solv =>
              solv(
                badgen({
                  label: "coverage",
                  status: Math.floor(coverage).toString() + "%",
                  color: formatter.match_color(coverage, style)
                })
              )
            )
        )
        .then(badge =>
          fs.promises.writeFile(path.join(report_path, "badge.svg"), badge)
        )
        .then(() =>
          fs.promises.writeFile(path.join(report_path, "index.html"), contents)
        )
        .then(() =>
          metadata.updateBranch({
            organization: org,
            repository: repo,
            branch,
            head: commit
          })
        )
        .then(result =>
          result
            ? res.status(200).send()
            : res.status(500).send(Messages.UnknownError)
        );
    });
  });

  const retrieve_file = (
    res: express.Response,
    identity: HeadIdentity,
    file: string
  ) => {
    const { organization: org, repository: repo, branch, head } = identity;

    const pathname = path.join(HOST_DIR, org, repo, branch, head, file);
    fs.access(pathname, fs.constants.R_OK, err =>
      err === null
        ? res.sendFile(pathname)
        : res.status(404).send(Messages.FileNotFound)
    );
  };

  router.get("/v1/:org/:repo/:branch.svg", (req, res) => {
    const { org, repo, branch } = req.params;

    metadata.getHeadCommit(org, repo, branch).then(
      result => {
        if (typeof result === "string") {
          const identity = {
            organization: org,
            repository: repo,
            branch,
            head: result.toString()
          };
          retrieve_file(res, identity, "badge.svg");
        } else {
          res.status(404).send(result.message);
        }
      },
      err => {
        logger.error(err);
        res.status(500).send(Messages.UnknownError);
      }
    );
  });

  router.get("/v1/:org/:repo/:branch.html", (req, res) => {
    const { org, repo, branch } = req.params;

    metadata.getHeadCommit(org, repo, branch).then(
      result => {
        if (typeof result === "string") {
          const identity = {
            organization: org,
            repository: repo,
            branch,
            head: result.toString()
          };
          retrieve_file(res, identity, "index.html");
        } else {
          res.status(404).send(result.message);
        }
      },
      err => {
        logger.error(err);
        res.status(500).send(Messages.UnknownError);
      }
    );
  });

  // provide hard link for commit
  router.get("/v1/:org/:repo/:branch/:commit.svg", (req, res) => {
    const { org, repo, branch, commit } = req.params;
    const identity = {
      organization: org,
      repository: repo,
      branch,
      head: commit
    };
    retrieve_file(res, identity, "badge.svg");
  });

  // provide hard link for commit
  router.get("/v1/:org/:repo/:branch/:commit.html", (req, res) => {
    const { org, repo, branch, commit } = req.params;
    const identity = {
      organization: org,
      repository: repo,
      branch,
      head: commit
    };
    retrieve_file(res, identity, "index.html");
  });

  return router;
};
