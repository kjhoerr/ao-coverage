import express, { Router } from "express";
import { badgen } from "badgen";
import winston from "winston";
import path from "path";
import fs from "fs";

import formats, { Format } from "./formats";
import Metadata, { HeadIdentity } from "./metadata";
import loggerConfig from "./util/logger";
import { InvalidReportDocumentError, Messages } from "./errors";

const logger = winston.createLogger(loggerConfig("HTTP"));

export default (metadata: Metadata): Router => {
  const router = Router();

  const commitFormatDocs = async (
    contents: string,
    identity: HeadIdentity,
    formatter: Format
  ): Promise<boolean | InvalidReportDocumentError> => {
    const reportPath = path.join(
      metadata.getHostDir(),
      identity.organization,
      identity.repository,
      identity.branch,
      identity.head
    );
    const coverage = await formatter.parseCoverage(contents);
    if (typeof coverage !== "number") {
      return coverage;
    }

    // Create report directory if not exists
    await fs.promises.mkdir(reportPath, { recursive: true });

    // Create report badge
    const style = metadata.getGradientStyle();
    const badge = badgen({
      label: "coverage",
      status: Math.floor(coverage).toString() + "%",
      color: formatter.matchColor(coverage, style)
    });

    // Write report and badge to directory
    await fs.promises.writeFile(path.join(reportPath, "badge.svg"), badge);
    await fs.promises.writeFile(
      path.join(reportPath, formatter.fileName),
      contents
    );

    // Update (or create) given branch with commit info
    return await metadata.updateBranch(identity);
  };

  // serve landing page
  router.get("/", (_, res) => {
    res.sendFile(path.join(metadata.getHostDir(), "index.html"));
  });

  // serve script for posting coverage report
  router.use(
    "/bash",
    express.static(path.join(metadata.getHostDir(), "bash"), {
      setHeaders: res => res.contentType("text/plain")
    })
  );

  // favicon should be served directly on root
  router.get("/favicon.ico", (_, res) => {
    res.sendFile(path.join(metadata.getPublicDir(), "static", "favicon.ico"));
  });
  // serve static files
  router.use(
    "/static",
    express.static(path.join(metadata.getPublicDir(), "static"))
  );

  // Upload HTML file
  router.post("/v1/:org/:repo/:branch/:commit.html", (req, res) => {
    const { org, repo, branch, commit } = req.params;

    const { token, format } = req.query;
    if (token != metadata.getToken()) {
      return res.status(401).send(Messages.InvalidToken);
    }

    if (typeof format !== "string" || !formats.listFormats().includes(format)) {
      return res.status(406).send(Messages.InvalidFormat);
    }

    const limit = metadata.getUploadLimit();
    if (Number(req.headers["content-length"] ?? 0) > limit) {
      return res.status(413).send(Messages.FileTooLarge);
    }

    let contents = "";
    req.on("data", raw => {
      if (contents.length <= limit) {
        contents += raw;
      }
    });
    req.on("end", async () => {
      // Ignore large requests
      if (contents.length > limit) {
        return res.status(413).send(Messages.FileTooLarge);
      }

      const formatter = formats.getFormat(format);
      const identity = {
        organization: org,
        repository: repo,
        branch,
        head: commit
      };

      try {
        const result = await commitFormatDocs(contents, identity, formatter);

        if (typeof result === "boolean") {
          if (result) {
            return res.status(200).send();
          } else {
            logger.error(
              "Unknown error while attempting to commit branch update"
            );
            return res.status(500).send(Messages.UnknownError);
          }
        } else {
          return res.status(400).send(Messages.InvalidFormat);
        }
      } catch (err) {
        logger.error(
          err ?? "Unknown error occurred while processing POST request"
        );
        return res.status(500).send(Messages.UnknownError);
      }
    });
  });

  // Upload XML file
  router.post("/v1/:org/:repo/:branch/:commit.xml", (req, res) => {
    const { org, repo, branch, commit } = req.params;

    const { token, format } = req.query;
    if (token != metadata.getToken()) {
      return res.status(401).send(Messages.InvalidToken);
    }

    if (typeof format !== "string" || !formats.listFormats().includes(format)) {
      return res.status(406).send(Messages.InvalidFormat);
    }

    const limit = metadata.getUploadLimit();
    if (Number(req.headers["content-length"] ?? 0) > limit) {
      return res.status(413).send(Messages.FileTooLarge);
    }

    let contents = "";
    req.on("data", raw => {
      if (contents.length <= limit) {
        contents += raw;
      }
    });
    req.on("end", async () => {
      // Ignore large requests
      if (contents.length > limit) {
        return res.status(413).send(Messages.FileTooLarge);
      }

      const formatter = formats.getFormat(format);
      const identity = {
        organization: org,
        repository: repo,
        branch,
        head: commit
      };

      try {
        const result = await commitFormatDocs(contents, identity, formatter);

        if (typeof result === "boolean") {
          if (result) {
            return res.status(200).send();
          } else {
            logger.error(
              "Unknown error while attempting to commit branch update"
            );
            return res.status(500).send(Messages.UnknownError);
          }
        } else {
          return res.status(400).send(Messages.InvalidFormat);
        }
      } catch (err) {
        logger.error(
          err ?? "Unknown error occurred while processing POST request"
        );
        return res.status(500).send(Messages.UnknownError);
      }
    });
  });

  const retrieveFile = (
    res: express.Response,
    identity: HeadIdentity,
    file: string
  ): void => {
    const { organization: org, repository: repo, branch, head } = identity;

    const pathname = path.join(
      metadata.getHostDir(),
      org,
      repo,
      branch,
      head,
      file
    );
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
        logger.error(
          err ?? "Error occurred while fetching commit for GET request"
        );
        res.status(500).send(Messages.UnknownError);
      }
    );
  });

  router.get("/v1/:org/:repo/:branch.html", (req, res) => {
    const { org, repo, branch } = req.params;
    const format = formats.formats.tarpaulin;

    metadata.getHeadCommit(org, repo, branch).then(
      result => {
        if (typeof result === "string") {
          const identity = {
            organization: org,
            repository: repo,
            branch,
            head: result.toString()
          };
          retrieveFile(res, identity, format.fileName);
        } else {
          res.status(404).send(result.message);
        }
      },
      err => {
        logger.error(
          err ?? "Error occurred while fetching commit for GET request"
        );
        res.status(500).send(Messages.UnknownError);
      }
    );
  });

  router.get("/v1/:org/:repo/:branch.xml", (req, res) => {
    const { org, repo, branch } = req.params;
    const format = formats.formats.cobertura;

    metadata.getHeadCommit(org, repo, branch).then(
      result => {
        if (typeof result === "string") {
          const identity = {
            organization: org,
            repository: repo,
            branch,
            head: result.toString()
          };
          retrieveFile(res, identity, format.fileName);
        } else {
          res.status(404).send(result.message);
        }
      },
      err => {
        logger.error(
          err ?? "Error occurred while fetching commit for GET request"
        );
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
    const format = formats.formats.tarpaulin;
    const identity = {
      organization: org,
      repository: repo,
      branch,
      head: commit
    };
    retrieveFile(res, identity, format.fileName);
  });

  router.get("/v1/:org/:repo/:branch/:commit.xml", (req, res) => {
    const { org, repo, branch, commit } = req.params;
    const format = formats.formats.cobertura;
    const identity = {
      organization: org,
      repository: repo,
      branch,
      head: commit
    };
    retrieveFile(res, identity, format.fileName);
  });

  router.use((_, res) => {
    res.status(404);
    res.sendFile(path.join(metadata.getPublicDir(), "static", "404.html"));
  });

  return router;
};
