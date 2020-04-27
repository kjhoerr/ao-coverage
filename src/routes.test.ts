import _request, { SuperTest, Test } from "supertest";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

process.env.UPLOAD_LIMIT = "40000";

import { configOrError, persistTemplate } from "./util/config";
import routes from "./routes";
import Metadata from "./metadata";
import { Template } from "./templates";
import { Db } from "mongodb";
import { badgen } from "badgen";
import { BranchNotFoundError } from "./errors";

type MetadataMockType = {
  database: Db;
  getHeadCommit: jest.Mock;
  updateBranch: jest.Mock;
  createRepository: jest.Mock;
};

const mock = (
  headCommit: jest.Mock = jest.fn(
    () => new Promise(solv => solv("testcommit"))
  ),
  updateBranch: jest.Mock = jest.fn(() => new Promise(solv => solv(true)))
): MetadataMockType => ({
  database: {} as Db,
  getHeadCommit: headCommit,
  updateBranch: updateBranch,
  createRepository: jest.fn()
});

const request = (mockMeta: MetadataMockType = mock()): SuperTest<Test> => {
  const app = express();

  app.use(routes(mockMeta as Metadata));
  return _request(app);
};

const HOST_DIR = configOrError("HOST_DIR");
const TARGET_URL = process.env.TARGET_URL ?? "http://localhost:3000";
const TOKEN = process.env.TOKEN ?? "";

describe("templates", () => {
  describe("GET /bash", () => {
    it("should return the bash file containing the curl command", async () => {
      await persistTemplate({
        inputFile: path.join(
          __dirname,
          "..",
          "public",
          "templates",
          "bash.template"
        ),
        outputFile: path.join(HOST_DIR, "bash"),
        context: { TARGET_URL }
      } as Template);

      const res = await request()
        .get("/bash")
        .expect(200);
      expect(res.text).toMatch("curl -X POST");
      expect(res.text).toMatch(`url="${TARGET_URL}"`);
    });
  });

  describe("GET /", () => {
    it("should return the index HTML file containing the bash command", async () => {
      await persistTemplate({
        inputFile: path.join(
          __dirname,
          "..",
          "public",
          "templates",
          "index.html.template"
        ),
        outputFile: path.join(HOST_DIR, "index.html"),
        context: { TARGET_URL }
      } as Template);

      const res = await request()
        .get("/")
        .expect("Content-Type", /html/)
        .expect(200);
      expect(res.text).toMatch(`bash &lt;(curl -s ${TARGET_URL}/bash)`);
    });
  });
});

describe("Static files", () => {
  const staticRoot = path.join(__dirname, "..", "public", "static");

  it("should return favicon.ico at GET /favicon.ico", async () => {
    const buffer = await fs.promises.readFile(
      path.join(staticRoot, "favicon.ico")
    );

    await request()
      .get("/favicon.ico")
      .expect("Content-Type", /icon/)
      .expect(buffer)
      .expect(200);
  });

  it("should return index.css at GET /static/index.css", async () => {
    const buffer = await fs.promises.readFile(
      path.join(staticRoot, "index.css")
    );

    const res = await request()
      .get("/static/index.css")
      .expect(200);
    expect(res.text).toEqual(buffer.toString("utf-8"));
  });
});

describe("Badges and reports", () => {
  const reportPath = path.join(
    HOST_DIR,
    "testorg",
    "testrepo",
    "testbranch",
    "testcommit"
  );
  const actualReport = path.join(
    __dirname,
    "..",
    "example_reports",
    "tarpaulin-report.html"
  );
  const fakeBadge = badgen({
    label: "coverage",
    status: "120%",
    color: "#E1C"
  });

  beforeAll(async () => {
    // place test files on HOST_DIR
    await fs.promises.mkdir(reportPath, { recursive: true });
    await fs.promises.copyFile(
      actualReport,
      path.join(reportPath, "index.html")
    );
    await fs.promises.writeFile(path.join(reportPath, "badge.svg"), fakeBadge);
  });

  describe("GET /v1/:org/:repo/:branch/:commit.html", () => {
    it("should retrieve the stored report file", async () => {
      const res = await request()
        .get("/v1/testorg/testrepo/testbranch/testcommit.html")
        .expect("Content-Type", /html/)
        .expect(200);
      const buffer = await fs.promises.readFile(actualReport);

      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should return 404 if file does not exist", async () => {
      await request()
        .get("/v1/neorg/nerepo/nebranch/necommit.html")
        .expect(404);
    });
  });

  describe("GET /v1/:org/:repo/:branch.html", () => {
    it("should retrieve the stored report file with the associated head commit", async () => {
      const mockMeta = mock();
      const res = await request(mockMeta)
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect("Content-Type", /html/)
        .expect(200);
      const buffer = await fs.promises.readFile(actualReport);

      expect(mockMeta.getHeadCommit).toHaveBeenCalledTimes(1);
      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should return 404 if file does not exist", async () => {
      await request()
        .get("/v1/neorg/nerepo/nebranch.html")
        .expect(404);
    });

    it("should return 404 if head commit not found", async () => {
      const head = jest.fn(
        () => new Promise(solv => solv(new BranchNotFoundError()))
      );
      await request(mock(head))
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect(404);
    });

    it("should return 500 if promise is rejected", async () => {
      const head = jest.fn(() => new Promise((_, rej) => rej("fooey")));
      await request(mock(head))
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect(500);
    });
  });

  describe("GET /v1/:org/:repo/:branch/:commit.svg", () => {
    it("should retrieve the stored report badge", async () => {
      const res = await request()
        .get("/v1/testorg/testrepo/testbranch/testcommit.svg")
        .expect("Content-Type", /svg/)
        .expect(200);

      expect(res.body.toString("utf-8")).toEqual(fakeBadge);
    });

    it("should return 404 if file does not exist", async () => {
      await request()
        .get("/v1/neorg/nerepo/nebranch/necommit.svg")
        .expect(404);
    });
  });

  describe("GET /v1/:org/:repo/:branch.svg", () => {
    it("should retrieve the stored report badge with the associated head commit", async () => {
      const mockMeta = mock();
      const res = await request(mockMeta)
        .get("/v1/testorg/testrepo/testbranch.svg")
        .expect("Content-Type", /svg/)
        .expect(200);

      expect(mockMeta.getHeadCommit).toHaveBeenCalledTimes(1);
      expect(res.body.toString("utf-8")).toEqual(fakeBadge);
    });

    it("should return 404 if file does not exist", async () => {
      await request()
        .get("/v1/neorg/nerepo/nebranch.svg")
        .expect(404);
    });

    it("should return 404 if head commit not found", async () => {
      const head = jest.fn(
        () => new Promise(solv => solv(new BranchNotFoundError()))
      );
      await request(mock(head))
        .get("/v1/testorg/testrepo/testbranch.svg")
        .expect(404);
    });

    it("should return 500 if promise is rejected", async () => {
      const head = jest.fn(() => new Promise((_, rej) => rej("fooey")));
      await request(mock(head))
        .get("/v1/testorg/testrepo/testbranch.svg")
        .expect(500);
    });
  });
});

describe("Uploads", () => {
  const reportPath = path.join(
    HOST_DIR,
    "testorg",
    "testrepo",
    "newthis",
    "newthat"
  );
  const data = fs.promises.readFile(
    path.join(__dirname, "..", "example_reports", "tarpaulin-report.html")
  );

  beforeEach(async () => {
    try {
      await fs.promises.rmdir(reportPath);
    } catch (err) {
      // ignore failures for rmdir
    }
  });

  describe("POST /v1/:org/:repo/:branch/:commit.html", () => {
    it("should upload the report and generate a badge", async () => {
      const mockMeta = mock();
      await request(mockMeta)
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send(await data)
        .expect(200);

      expect(mockMeta.updateBranch).toBeCalledWith({
        organization: "testorg",
        repository: "testrepo",
        branch: "newthis",
        head: "newthat"
      });
      expect(mockMeta.updateBranch).toHaveBeenCalledTimes(1);
      await fs.promises.access(
        path.join(reportPath, "index.html"),
        fs.constants.R_OK
      );
      await fs.promises.access(
        path.join(reportPath, "badge.svg"),
        fs.constants.R_OK
      );
    });

    it("should return 401 when token is not correct", async () => {
      await request()
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=wrong&format=tarpaulin`
        )
        .send(await data)
        .expect(401);
    });

    it("should return 406 with an invalid format", async () => {
      await request()
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=pepperoni`
        )
        .send(await data)
        .expect(406);
    });

    it("should return 400 when request body is not the appropriate format", async () => {
      await request()
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send("This is not a file")
        .expect(400);
    });

    it("should return 413 when request body is not the appropriate format", async () => {
      const file = await data;
      const bigData = Buffer.concat([file, file]);
      await request()
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send(bigData)
        .expect(413);
    });

    it("should return 500 when Metadata does not create branch", async () => {
      const update = jest.fn(() => new Promise(solv => solv(false)));
      await request(mock(jest.fn(), update))
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send(await data)
        .expect(500);
    });

    it("should return 500 when promise chain is rejected", async () => {
      const update = jest.fn(() => new Promise((_, rej) => rej("fooey 2")));
      await request(mock(jest.fn(), update))
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send(await data)
        .expect(500);
    });
  });
});
