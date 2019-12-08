import dotenv from "dotenv";
import express from "express";
import { JSDOM } from "jsdom";
import { badgen } from "badgen";
import { MongoClient } from "mongodb";
import path from "path";
import fs from "fs";

import formats, { Format } from "./formats";
import Metadata from "./metadata";

// Start-up configuration
dotenv.config();
const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.TOKEN || "";
const UPLOAD_LIMIT = Number(process.env.UPLOAD_LIMIT || 4194304);
const MONGO_URI =
  process.env.MONGO_URI ||
  (() => {
    throw Error("MONGO_URI must be defined");
  })();
const MONGO_DB = process.env.MONGO_DB || "ao-coverage";
const HOST_DIR =
  process.env.HOST_DIR ||
  (() => {
    throw Error("HOST_DIR must be defined");
  })();

fs.accessSync(HOST_DIR, fs.constants.R_OK | fs.constants.W_OK);
if (!path.isAbsolute(HOST_DIR)) {
  throw Error("HOST_DIR must be an absolute path");
}

new MongoClient(MONGO_URI, { useUnifiedTopology: true }).connect(
  (err, mongo) => {
    if (err !== null) {
      throw err;
    }

    const app: express.Application = express();
    const metadata = new Metadata(mongo.db(MONGO_DB));

    // Upload HTML file
    app.post("/v1/:org/:repo/:branch/:commit.html", (req, res) => {
      const { org, repo, branch, commit } = req.params;
      console.info(
        "POST request to /v1/%s/%s/%s/%s.html",
        org,
        repo,
        branch,
        commit
      );

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
            fs.promises.writeFile(
              path.join(report_path, "index.html"),
              contents
            )
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

    app.get("/v1/:org/:repo/:branch.svg", (req, res) => {
      const { org, repo, branch } = req.params;
      console.info("GET request to /v1/%s/%s/%s.svg", org, repo, branch);

      metadata.getHeadCommit(org, repo, branch).then(
        commit => {
          console.debug(
            "Found commit %s for ORB %s/%s/%s",
            commit,
            org,
            repo,
            branch
          );

          res.sendFile(
            path.join(HOST_DIR, org, repo, branch, commit, "badge.svg")
          );
        },
        () => {
          res.status(500).send("Unknown error occurred");
        }
      );
    });

    app.get("/v1/:org/:repo/:branch.html", (req, res) => {
      const { org, repo, branch } = req.params;
      console.info("GET request to /v1/%s/%s/%s.html", org, repo, branch);

      metadata.getHeadCommit(org, repo, branch).then(
        commit => {
          console.debug(
            "Found commit %s for ORB %s/%s/%s",
            commit,
            org,
            repo,
            branch
          );

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
    app.get("/v1/:org/:repo/:branch/:commit.svg", (req, res) => {
      const { org, repo, branch, commit } = req.params;
      console.info(
        "GET request to /v1/%s/%s/%s/%s.svg",
        org,
        repo,
        branch,
        commit
      );

      res.sendFile(path.join(HOST_DIR, org, repo, branch, commit, "badge.svg"));
    });

    // provide hard link for commit
    app.get("/v1/:org/:repo/:branch/:commit.html", (req, res) => {
      const { org, repo, branch, commit } = req.params;
      console.info(
        "GET request to /v1/%s/%s/%s/%s.html",
        org,
        repo,
        branch,
        commit
      );

      res.sendFile(
        path.join(HOST_DIR, org, repo, branch, commit, "index.html")
      );
    });

    const server = app.listen(PORT, () => {
      console.log("Express started on port " + PORT);
    });

    // application exit handling
    const handle_closure = (signal: NodeJS.Signals) => {
      console.log("%s signal received. Closing shop.", signal);

      mongo.close().then(() => {
        console.log("Mongo client connection closed.");
        server.close(() => {
          console.log("Express down.");
          process.exit();
        });
      });
    };

    const handle_codes: NodeJS.Signals[] = ["SIGTERM", "SIGHUP", "SIGINT"];
    const process_event = (code: NodeJS.Signals) =>
      process.on(code, handle_closure);
    handle_codes.map(process_event);
  }
);
