import express, { Router } from "express";
import { JSDOM } from "jsdom";
import { badgen } from "badgen";
import winston from "winston";
import path from "path";
import fs from "fs";

import formats, { GradientStyle } from "./formats";
import Metadata, { HeadIdentity } from "./metadata";
import { configOrError } from "./util/config";
import loggerConfig from "./util/logger";
import { Messages } from "./errors";

const TOKEN = process.env.TOKEN || "";
const UPLOAD_LIMIT = Number(process.env.UPLOAD_LIMIT || 4194304);
const HOST_DIR = configOrError("HOST_DIR");

const logger = winston.createLogger(loggerConfig("HTTP"));

export default (metadata: Metadata): Router => {
  const router = Router();

  // Upload HTML file
  router.post("/v1/:org/:repo/:branch/:commit.html", (req, res) => {
    const { org, repo, branch, commit } = req.params;

    const { token, format } = req.query;
    //TODO @Metadata token should come from metadata
    if (token != TOKEN) {
      return res.status(401).send(Messages.InvalidToken);
    }

    if (!formats.listFormats().includes(format)) {
      return res.status(406).send(Messages.InvalidFormat);
    }

    let contents = "";
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
      const formatter = formats.getFormat(format);

      const result = formatter.parseCoverage(doc);
      if (typeof result === "number") {
        coverage = result;
      } else {
        return res.status(400).send(result.message);
      }

      const reportPath = path.join(HOST_DIR, org, repo, branch, commit);

      fs.promises
        .mkdir(reportPath, { recursive: true })
        .then(
          () =>
            //TODO @Metadata stage values should come from metadata
            new Promise<GradientStyle>(solv => solv({ stage1: 95, stage2: 80 }))
        )
        .then(
          style =>
            new Promise(solv =>
              solv(
                badgen({
                  label: "coverage",
                  status: Math.floor(coverage).toString() + "%",
                  color: formatter.matchColor(coverage, style)
                })
              )
            )
        )
        .then(badge =>
          fs.promises.writeFile(path.join(reportPath, "badge.svg"), badge)
        )
        .then(() =>
          fs.promises.writeFile(path.join(reportPath, "index.html"), contents)
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

  const retrieveFile = (
    res: express.Response,
    identity: HeadIdentity,
    file: string
  ): void => {
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
          retrieveFile(res, identity, "badge.svg");
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
          retrieveFile(res, identity, "index.html");
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
    retrieveFile(res, identity, "badge.svg");
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
    retrieveFile(res, identity, "index.html");
  });

  return router;
};
