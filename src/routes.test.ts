import _request, { SuperTest, Test } from "supertest";
import express from "express";
import fs from "fs";
import path from "path";
import winston from "winston";
import { badgen } from "badgen";

import { persistTemplate } from "./config";
import routes from "./routes";
import Metadata, { EnvConfig } from "./metadata";
import { Template } from "./templates";
import { BranchNotFoundError } from "./errors";

jest.mock("./util/logger", () => ({
  __esModule: true,
  default: () => ({
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.simple()
    ),
    transports: [new winston.transports.Console({ silent: true })],
  }),
}));

import loggerConfig from "./util/logger";
import dotenv from "dotenv";
import { Db } from "mongodb";
dotenv.config();

const LOGGER = winston.createLogger(loggerConfig("TEST", "debug"));
const HOST_DIR =
  process.env.HOST_DIR ??
  (() => {
    const dir = path.join(__dirname, "..", "dist");
    console.warn(
      `WARNING: HOST_DIR is not set - this is used to query files in src/routes.test.ts. Using '${dir}' as default HOST_DIR.`
    );
    return dir;
  })();
const TARGET_URL = "https://localhost:3000";
const TOKEN = "THISISCORRECT";

const config: EnvConfig = {
  token: TOKEN,
  // should be just larger than the example report used
  uploadLimit: Number(40000),
  hostDir: HOST_DIR,
  publicDir: path.join(__dirname, "..", "public"),
  stage1: 95,
  stage2: 80,
  bindAddress: "localhost",
  targetUrl: TARGET_URL,
  port: 3000,
  dbName: "ao-coverage",
  dbUri: "localhost",
  logLevel: "debug",
};

const defaultMetadata = {
  logger: LOGGER,
  database: {} as Db,
  config: config,
  getToken: () => config.token,
  getUploadLimit: () => config.uploadLimit,
  getHostDir: () => config.hostDir,
  getPublicDir: () => config.publicDir,
  getGradientStyle: () => ({
    stage1: config.stage1,
    stage2: config.stage2,
  }),
  getHeadCommit: jest.fn<
    Promise<{ commit: string; format: string } | BranchNotFoundError>,
    string[]
  >(() =>
    Promise.resolve({
      commit: "testcommit",
      format: "tarpaulin",
    })
  ),
  updateBranch: jest.fn(() => Promise.resolve(true)),
  createRepository: jest.fn(() => Promise.resolve(true)),
};
const request = async (): Promise<SuperTest<Test>> => {
  const app = express();

  app.use(routes(defaultMetadata as Metadata));
  return _request(app);
};

test("HOST_DIR must be readable and writable", () => {
  expect(() => {
    // If read/write is okay, attempt directory creation for test compatibility
    fs.mkdirSync(HOST_DIR, { recursive: true });
    fs.accessSync(HOST_DIR, fs.constants.W_OK | fs.constants.R_OK);
  }).not.toThrowError();
});

describe("templates", () => {
  describe("GET /sh", () => {
    it("should return the sh file containing the curl command", async () => {
      await persistTemplate(
        {
          inputFile: path.join(
            __dirname,
            "..",
            "public",
            "templates",
            "sh.tmpl"
          ),
          outputFile: path.join(HOST_DIR, "sh"),
          context: { TARGET_URL },
        } as Template,
        LOGGER
      );

      const res = await (await request()).get("/sh").expect(200);
      expect(res.text).toMatch("curl -X POST");
      expect(res.text).toMatch(`url="${TARGET_URL}"`);
    });
  });

  describe("GET /", () => {
    it("should return the index HTML file containing the bash command", async () => {
      await persistTemplate(
        {
          inputFile: path.join(
            __dirname,
            "..",
            "public",
            "templates",
            "index.html.tmpl"
          ),
          outputFile: path.join(HOST_DIR, "index.html"),
          context: { TARGET_URL, CURL_HTTPS: "--https " },
        } as Template,
        LOGGER
      );

      const res = await (await request())
        .get("/")
        .expect("Content-Type", /html/)
        .expect(200);
      expect(res.text).toMatch(`curl --https -sSf ${TARGET_URL}/sh | sh`);
    });
  });
});

describe("Static files", () => {
  const staticRoot = path.join(__dirname, "..", "public", "static");

  it("should return favicon.ico at GET /favicon.ico", async () => {
    const buffer = await fs.promises.readFile(
      path.join(staticRoot, "favicon.ico")
    );

    await (await request())
      .get("/favicon.ico")
      .expect("Content-Type", /icon/)
      .expect(buffer)
      .expect(200);
  });

  it("should return index.css at GET /static/index.css", async () => {
    const buffer = await fs.promises.readFile(
      path.join(staticRoot, "index.css")
    );

    const res = await (await request()).get("/static/index.css").expect(200);
    expect(res.text).toEqual(buffer.toString("utf-8"));
  });

  it("should return 404.html at unhandled endpoints", async () => {
    const buffer = await fs.promises.readFile(
      path.join(staticRoot, "404.html")
    );

    const res = await (await request()).get("/thisisnotanendpoint").expect(404);
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
  const tarpaulinReport = path.join(
    __dirname,
    "..",
    "example_reports",
    "tarpaulin-report.html"
  );
  const coberturaReport = path.join(
    __dirname,
    "..",
    "example_reports",
    "cobertura-report.xml"
  );
  const fakeBadge = badgen({
    label: "coverage",
    status: "120%",
    color: "#E1C",
  });

  beforeAll(async () => {
    // place test files on HOST_DIR
    await fs.promises.mkdir(reportPath, { recursive: true });
    await fs.promises.copyFile(
      tarpaulinReport,
      path.join(reportPath, "index.html")
    );
    await fs.promises.copyFile(
      coberturaReport,
      path.join(reportPath, "index.xml")
    );
    await fs.promises.writeFile(path.join(reportPath, "badge.svg"), fakeBadge);
  });

  describe("GET /v1/:org/:repo/:branch/:commit.html", () => {
    it("should retrieve the stored report file", async () => {
      const res = await (await request())
        .get("/v1/testorg/testrepo/testbranch/testcommit.html")
        .expect("Content-Type", /html/)
        .expect(200);
      const buffer = await fs.promises.readFile(tarpaulinReport);

      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should return 404 if file does not exist", async () => {
      await (await request())
        .get("/v1/neorg/nerepo/nebranch/necommit.html")
        .expect(404);
    });
  });

  describe("GET /v1/:org/:repo/:branch/:commit.xml", () => {
    it("should retrieve the stored report file", async () => {
      const res = await (await request())
        .get("/v1/testorg/testrepo/testbranch/testcommit.xml")
        .expect("Content-Type", /xml/)
        .expect(200);
      const buffer = await fs.promises.readFile(coberturaReport);

      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should return 404 if file does not exist", async () => {
      await (await request())
        .get("/v1/neorg/nerepo/nebranch/necommit.xml")
        .expect(404);
    });
  });

  describe("GET /v1/:org/:repo/:branch.html", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should retrieve the stored report file with the associated head commit", async () => {
      // Arrange
      const headCommit = { commit: "testcommit", format: "tarpaulin" };
      const head =
        defaultMetadata.getHeadCommit.mockResolvedValueOnce(headCommit);
      const buffer = await fs.promises.readFile(tarpaulinReport);

      // Act
      const res = await (await request())
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect("Content-Type", /html/)
        .expect(200);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should retrieve the marked format as stored in metadata", async () => {
      // Arrange
      const headCommit = { commit: "testcommit", format: "cobertura" };
      const head =
        defaultMetadata.getHeadCommit.mockResolvedValueOnce(headCommit);
      const buffer = await fs.promises.readFile(coberturaReport);

      // Act
      const res = await (await request())
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect("Content-Type", /xml/)
        .expect(200);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should return 404 if file does not exist", async () => {
      await (await request()).get("/v1/neorg/nerepo/nebranch.html").expect(404);
    });

    it("should return 404 if head commit not found", async () => {
      // Arrange
      const head = defaultMetadata.getHeadCommit.mockResolvedValueOnce(
        new BranchNotFoundError()
      );

      // Act
      await (await request())
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect(404);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
    });

    it("should return 500 if promise is rejected", async () => {
      // Arrang
      const head = defaultMetadata.getHeadCommit.mockRejectedValueOnce("fooey");

      // Act
      await (await request())
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect(500);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /v1/:org/:repo/:branch.xml", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should retrieve the stored report file with the associated head commit", async () => {
      // Arrange
      const headCommit = { commit: "testcommit", format: "cobertura" };
      const head =
        defaultMetadata.getHeadCommit.mockResolvedValueOnce(headCommit);
      const buffer = await fs.promises.readFile(coberturaReport);

      // Act
      const res = await (await request())
        .get("/v1/testorg/testrepo/testbranch.xml")
        .expect("Content-Type", /xml/)
        .expect(200);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should retrieve the marked format as stored in metadata", async () => {
      // Arrange
      const headCommit = { commit: "testcommit", format: "tarpaulin" };
      const head =
        defaultMetadata.getHeadCommit.mockResolvedValueOnce(headCommit);
      const buffer = await fs.promises.readFile(tarpaulinReport);

      // Act
      const res = await (await request())
        .get("/v1/testorg/testrepo/testbranch.xml")
        .expect("Content-Type", /html/)
        .expect(200);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should return 404 if file does not exist", async () => {
      await (await request()).get("/v1/neorg/nerepo/nebranch.xml").expect(404);
    });

    it("should return 404 if head commit not found", async () => {
      // Arrange
      const head = defaultMetadata.getHeadCommit.mockResolvedValueOnce(
        new BranchNotFoundError()
      );

      // Act
      await (await request())
        .get("/v1/testorg/testrepo/testbranch.xml")
        .expect(404);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
    });

    it("should return 500 if promise is rejected", async () => {
      // Arrange
      const head = defaultMetadata.getHeadCommit.mockRejectedValueOnce("fooey");

      // Act
      await (await request())
        .get("/v1/testorg/testrepo/testbranch.xml")
        .expect(500);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /v1/:org/:repo/:branch/:commit.svg", () => {
    it("should retrieve the stored report badge", async () => {
      const res = await (await request())
        .get("/v1/testorg/testrepo/testbranch/testcommit.svg")
        .expect("Content-Type", /svg/)
        .expect(200);

      expect(res.body.toString("utf-8")).toEqual(fakeBadge);
    });

    it("should return 404 if file does not exist", async () => {
      await (await request())
        .get("/v1/neorg/nerepo/nebranch/necommit.svg")
        .expect(404);
    });
  });

  describe("GET /v1/:org/:repo/:branch.svg", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should retrieve the stored report badge with the associated head commit", async () => {
      // Arrange
      const headCommit = { commit: "testcommit", format: "tarpaulin" };
      const head =
        defaultMetadata.getHeadCommit.mockResolvedValueOnce(headCommit);

      // Act
      const res = await (await request())
        .get("/v1/testorg/testrepo/testbranch.svg")
        .expect("Content-Type", /svg/)
        .expect(200);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
      expect(res.body.toString("utf-8")).toEqual(fakeBadge);
    });

    it("should return 404 if file does not exist", async () => {
      await (await request()).get("/v1/neorg/nerepo/nebranch.svg").expect(404);
    });

    it("should return 404 if head commit not found", async () => {
      // Arrange
      const head = defaultMetadata.getHeadCommit.mockResolvedValueOnce(
        new BranchNotFoundError()
      );

      // Act
      await (await request())
        .get("/v1/testorg/testrepo/testbranch.svg")
        .expect(404);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
    });

    it("should return 500 if promise is rejected", async () => {
      // Arrange
      const head = defaultMetadata.getHeadCommit.mockRejectedValueOnce("fooey");

      // Act
      await (await request())
        .get("/v1/testorg/testrepo/testbranch.svg")
        .expect(500);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
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

  beforeEach(async () => {
    try {
      await fs.promises.rmdir(reportPath);
    } catch (err) {
      // ignore failures for rmdir
    }
  });

  describe("GET /v1/health-check", () => {
    it("should return 200 OK", async () => {
      await (await request()).get(`/v1/health-check`).send().expect(200);
    });
  });

  describe("POST /v1/:org/:repo/:branch/:commit.html", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const data = fs.promises.readFile(
      path.join(__dirname, "..", "example_reports", "tarpaulin-report.html")
    );

    it("should upload the report and generate a badge", async () => {
      // Arrange
      const head = defaultMetadata.updateBranch.mockResolvedValueOnce(true);

      // Act
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send(await data)
        .expect(200);

      // Assert
      expect(head).toBeCalledWith({
        organization: "testorg",
        repository: "testrepo",
        branch: "newthis",
        head: { commit: "newthat", format: "tarpaulin" },
      });
      expect(head).toHaveBeenCalledTimes(1);
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
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=wrong&format=tarpaulin`
        )
        .send(await data)
        .expect(401);
    });

    it("should return 406 with an invalid format", async () => {
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=pepperoni`
        )
        .send(await data)
        .expect(406);
    });

    it("should return 400 when request body is not the appropriate format", async () => {
      await (await request())
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send("This is not a file")
        .expect(400);
    });

    it("should return 413 when request body is not the appropriate format", async () => {
      const file = await data;
      let bigData = file;
      while (bigData.length <= config.uploadLimit) {
        bigData = Buffer.concat([bigData, file]);
      }
      await (await request())
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send(bigData)
        .expect(413);
    });

    it("should return 500 when Metadata does not create branch", async () => {
      // Arrange
      const head = defaultMetadata.updateBranch.mockResolvedValueOnce(false);

      // Act
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send(await data)
        .expect(500);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
    });

    it("should return 500 when promise chain is rejected", async () => {
      // Arrange
      const head =
        defaultMetadata.updateBranch.mockRejectedValueOnce("fooey 2");

      // Act
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${TOKEN}&format=tarpaulin`
        )
        .send(await data)
        .expect(500);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /v1/:org/:repo/:branch/:commit.xml", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const data = fs.promises.readFile(
      path.join(__dirname, "..", "example_reports", "cobertura-report.xml")
    );

    it("should upload the report and generate a badge", async () => {
      // Arrange
      const head = defaultMetadata.updateBranch.mockResolvedValueOnce(true);

      // Act
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${TOKEN}&format=cobertura`
        )
        .send(await data)
        .expect(200);

      expect(head).toBeCalledWith({
        organization: "testorg",
        repository: "testrepo",
        branch: "newthis",
        head: { commit: "newthat", format: "cobertura" },
      });
      expect(head).toHaveBeenCalledTimes(1);
      await fs.promises.access(
        path.join(reportPath, "index.xml"),
        fs.constants.R_OK
      );
      await fs.promises.access(
        path.join(reportPath, "badge.svg"),
        fs.constants.R_OK
      );
    });

    it("should return 401 when token is not correct", async () => {
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=wrong&format=cobertura`
        )
        .send(await data)
        .expect(401);
    });

    it("should return 406 with an invalid format", async () => {
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${TOKEN}&format=pepperoni`
        )
        .send(await data)
        .expect(406);
    });

    it("should return 400 when request body is not the appropriate format", async () => {
      await (await request())
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${TOKEN}&format=cobertura`
        )
        .send("This is not a file")
        .expect(400);
    });

    it("should return 413 when request body is not the appropriate format", async () => {
      const file = await data;
      let bigData = file;
      while (bigData.length <= config.uploadLimit) {
        bigData = Buffer.concat([bigData, file]);
      }
      await (await request())
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${TOKEN}&format=cobertura`
        )
        .send(bigData)
        .expect(413);
    });

    it("should return 500 when Metadata does not create branch", async () => {
      // Arrange
      const head = defaultMetadata.updateBranch.mockResolvedValueOnce(false);

      // Act
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${TOKEN}&format=cobertura`
        )
        .send(await data)
        .expect(500);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
    });

    it("should return 500 when promise chain is rejected", async () => {
      // Arrange
      const head =
        defaultMetadata.updateBranch.mockRejectedValueOnce("fooey 2");

      // Act
      await (
        await request()
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${TOKEN}&format=cobertura`
        )
        .send(await data)
        .expect(500);

      // Assert
      expect(head).toHaveBeenCalledTimes(1);
    });
  });
});
