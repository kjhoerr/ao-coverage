import dotenv from 'dotenv';
import express from 'express';
import badgen from 'badgen';
import path from 'path';
import fs from 'fs';

import formats from './formats';
import metadata from './metadata';

// Start-up configuration
dotenv.config();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const TOKEN = process.env.TOKEN || "";
const HOST_DIR = process.env.HOST_DIR || (() => {
  throw Error("HOST_DIR must be defined");
})();

const app: express.Application = express();

// serve script for posting coverage report
app.use('/bash', express.static(path.join(__dirname, '..', 'public', 'bash')));

// Upload HTML file 
app.post('/v1/:org/:repo/:branch/:commit.html', (req, res) => {

  const {org, repo, branch, commit} = req.params;
  console.info("POST request to /v1/%s/%s/%s/%s.html", org, repo, branch, commit);

  const {token, format} = req.query;
  if (token != TOKEN) {
    return res.status(401).send();
  }

  const reporter = format || "tarpaulin";
  if (!formats.list_formats().includes(reporter)) {
    return res.status(406).send();
  }

  return res.status(501).send();

  //TODO acquire file, verify file size/content type (HTML)
  const contents = "";
  //req.on('data', (raw) => {});
  //req.on('end', () => {});

  // const doc = new DOMParser().parseFromString(contents, "text/html");
  // const coverage = formats.get_format(reporter).parse_coverage(doc);
  //TODO create badge for coverage %
  //TODO store coverage % badge at %HOST_DIR%/%org%/%repo%/%commit%/badge.svg
  //TODO store uploaded file at %HOST_DIR%/%org%/%repo%/%commit%/index.html

  //TODO set branch alias for coverage % / uploaded file
});

app.get('/v1/:org/:repo/:branch.svg', (req, res) => {
  const {org, repo, branch} = req.params;
  console.info("GET request to /v1/%s/%s/%s.svg", org, repo, branch);

  //TODO link the badge via metadata
  return res.status(501).send();
});

app.get('/v1/:org/:repo/:branch.html', (req, res) => {
  const {org, repo, branch} = req.params;
  console.info("GET request to /v1/%s/%s/%s.html", org, repo, branch);

  //TODO link the file via metadata
  return res.status(501).send();
});

// provide hard link for commit
app.get('/v1/:org/:repo/:branch/:commit.svg', (req, res) => {
  const {org, repo, branch, commit} = req.params;
  console.info("GET request to /v1/%s/%s/%s/%s.svg", org, repo, branch, commit);

  //TODO link the badge
  return res.status(501).send();
});

// provide hard link for commit
app.get('/v1/:org/:repo/:branch/:commit.html', (req, res) => {
  const {org, repo, branch, commit} = req.params;
  console.info("GET request to /v1/%s/%s/%s/%s.html", org, repo, branch, commit);
  
  //TODO link the file
  return res.status(501).send();
});

app.listen(PORT, () => {
  console.log('Express started on port ' + PORT);
});
