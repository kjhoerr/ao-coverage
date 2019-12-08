import express from "express";
import { JSDOM } from "jsdom";
import { badgen } from "badgen";
import path from "path";
import fs from "fs";

import formats, { Format } from "./formats";
import Metadata from "./metadata";
import { config_or_error } from "./util/config";

const TOKEN = process.env.TOKEN || "";
const UPLOAD_LIMIT = Number(process.env.UPLOAD_LIMIT || 4194304);
const HOST_DIR = config_or_error("HOST_DIR");

export default (metadata: Metadata) => {
  const router = express.Router();

  // Upload HTML file
  router.post("/v1/:org/:repo/:branch/:commit.html", (req, res) => {
    const { org, repo, branch, commit } = req.params;

    const { token, format } = req.query;
    //TODO @Metadata token should come from metadata
    if (token != TOKEN) {
      return res.status(401).send("Invalid token");
    }

    if (!formats.list_formats().includes(format)) {
      return res.status(406).send("Report format unknown");
    }

    var contents = "";
    req.on("data", raw => {
      if (contents.length + raw.length > UPLOAD_LIMIT) {
        res.status(413).send("Uploaded file is too large");
      } else {
        contents += raw;
      }
    });
    req.on("end", () => {
      let formatter: Format, coverage: number;
      try {
        const doc = new JSDOM(contents).window.document;
        formatter = formats.get_format(format);
        coverage = formatter.parse_coverage(doc);
      } catch {
        return res.status(400).send("Invalid report document");
      }

      const badge = badgen({
        label: "coverage",
        status: Math.floor(coverage).toString() + "%",
        //TODO @Metadata stage values should come from metadata
        color: formatter.match_color(coverage, 95, 80)
      });

      const report_path = path.join(HOST_DIR, org, repo, branch, commit);

      fs.promises
        .mkdir(report_path, { recursive: true })
        .then(() =>
          fs.promises.writeFile(path.join(report_path, "badge.svg"), badge)
        )
        .then(() =>
          fs.promises.writeFile(path.join(report_path, "index.html"), contents)
        )
        .then(() =>
          metadata.updateBranch({ org, repo, name: branch, head: commit })
        )
        .then(result =>
          result
            ? res.status(200).send()
            : res.status(500).send("Unknown error occurred")
        );
    });
  });

  router.get("/v1/:org/:repo/:branch.svg", (req, res) => {
    const { org, repo, branch } = req.params;

    metadata.getHeadCommit(org, repo, branch).then(
      commit => {
        res.sendFile(
          path.join(HOST_DIR, org, repo, branch, commit, "badge.svg")
        );
      },
      () => {
        res.status(500).send("Unknown error occurred");
      }
    );
  });

  router.get("/v1/:org/:repo/:branch.html", (req, res) => {
    const { org, repo, branch } = req.params;

    metadata.getHeadCommit(org, repo, branch).then(
      commit => {
        res.sendFile(
          path.join(HOST_DIR, org, repo, branch, commit, "index.html")
        );
      },
      () => {
        res.status(500).send("Unknown error occurred");
      }
    );
  });

  // provide hard link for commit
  router.get("/v1/:org/:repo/:branch/:commit.svg", (req, res) => {
    const { org, repo, branch, commit } = req.params;

    res.sendFile(path.join(HOST_DIR, org, repo, branch, commit, "badge.svg"));
  });

  // provide hard link for commit
  router.get("/v1/:org/:repo/:branch/:commit.html", (req, res) => {
    const { org, repo, branch, commit } = req.params;

    res.sendFile(path.join(HOST_DIR, org, repo, branch, commit, "index.html"));
  });

  return router;
};
