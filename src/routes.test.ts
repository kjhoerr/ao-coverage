// The environment variable HOST_DIR must be defined for the tests to
// work. Mocking exit gives a more descriptive error.
const exit = jest
  .spyOn(process, "exit")
  .mockImplementation(() => undefined as never);
import _request, { SuperTest, Test } from "supertest";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

test("Environment variable HOST_DIR must be defined", () => {
  expect(process.env.HOST_DIR).not.toBeUndefined();
});
test("HOST_DIR must be readable and writable", () => {
  expect(() =>
    fs.accessSync(
      process.env.HOST_DIR ?? "",
      fs.constants.W_OK | fs.constants.R_OK
    )
  ).not.toThrowError();
});

import { Writable } from "stream";
import winston from "winston";

let output = "";

jest.mock("./util/logger", () => {
  const stream = new Writable();
  stream._write = (chunk, _encoding, next) => {
    output = output += chunk.toString();
    next();
  };
  const streamTransport = new winston.transports.Stream({ stream });

  return {
    __esModule: true,
    default: () => ({
      format: winston.format.combine(
        winston.format.splat(),
        winston.format.simple()
      ),
      transports: [streamTransport],
    }),
  };
});

import { configOrError, persistTemplate } from "./util/config";
import routes from "./routes";
import Metadata, { EnvConfig } from "./metadata";
import { Template } from "./templates";
import { Db } from "mongodb";
import { badgen } from "badgen";
import { BranchNotFoundError } from "./errors";

type MetadataMockType = {
  database: Db;
  config: EnvConfig;
  getHeadCommit: jest.Mock;
  getToken: jest.Mock;
  getUploadLimit: jest.Mock;
  getHostDir: jest.Mock;
  getPublicDir: jest.Mock;
  getGradientStyle: jest.Mock;
  updateBranch: jest.Mock;
  createRepository: jest.Mock;
};

const config = {
  token: "THISISCORRECT",
  // should be just larger than the example report used
  uploadLimit: Number(40000),
  hostDir: configOrError("HOST_DIR"),
  publicDir: path.join(__dirname, "..", "public"),
  stage1: 95,
  stage2: 80,
};
const mock = (
  headCommit: jest.Mock = jest.fn(
    () =>
      new Promise((solv) => solv({ commit: "testcommit", format: "tarpaulin" }))
  ),
  updateBranch: jest.Mock = jest.fn(() => new Promise((solv) => solv(true)))
): MetadataMockType => ({
  database: {} as Db,
  config: config,
  getToken: jest.fn(() => config.token),
  getUploadLimit: jest.fn(() => config.uploadLimit),
  getHostDir: jest.fn(() => config.hostDir),
  getPublicDir: jest.fn(() => config.publicDir),
  getGradientStyle: jest.fn(() => ({
    stage1: config.stage1,
    stage2: config.stage2,
  })),
  getHeadCommit: headCommit,
  updateBranch: updateBranch,
  createRepository: jest.fn(),
});

const request = async (
  mockMeta: MetadataMockType = mock()
): Promise<SuperTest<Test>> => {
  const app = express();

  app.use(routes(mockMeta as Metadata));
  return _request(app);
};

const HOST_DIR = configOrError("HOST_DIR");
const TARGET_URL = "https://localhost:3000";

describe("templates", () => {
  describe("GET /sh", () => {
    it("should return the sh file containing the curl command", async () => {
      await persistTemplate({
        inputFile: path.join(__dirname, "..", "public", "templates", "sh.tmpl"),
        outputFile: path.join(HOST_DIR, "sh"),
        context: { TARGET_URL },
      } as Template);

      const res = await (await request()).get("/sh").expect(200);
      expect(exit).not.toHaveBeenCalled();
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
          "index.html.tmpl"
        ),
        outputFile: path.join(HOST_DIR, "index.html"),
        context: { TARGET_URL, CURL_HTTPS: "--https " },
      } as Template);

      const res = await (await request())
        .get("/")
        .expect("Content-Type", /html/)
        .expect(200);
      expect(exit).not.toHaveBeenCalled();
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
    it("should retrieve the stored report file with the associated head commit", async () => {
      const mockMeta = mock();
      const res = await (await request(mockMeta))
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect("Content-Type", /html/)
        .expect(200);
      const buffer = await fs.promises.readFile(tarpaulinReport);

      expect(mockMeta.getHeadCommit).toHaveBeenCalledTimes(1);
      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should retrieve the marked format as stored in metadata", async () => {
      const head = jest.fn(
        () =>
          new Promise((solv) =>
            solv({ commit: "testcommit", format: "cobertura" })
          )
      );
      const mockMeta = mock(head);
      // request HTML, get XML
      const res = await (await request(mockMeta))
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect("Content-Type", /xml/)
        .expect(200);
      const buffer = await fs.promises.readFile(coberturaReport);

      expect(mockMeta.getHeadCommit).toHaveBeenCalledTimes(1);
      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should return 404 if file does not exist", async () => {
      await (await request()).get("/v1/neorg/nerepo/nebranch.html").expect(404);
    });

    it("should return 404 if head commit not found", async () => {
      const head = jest.fn(
        () => new Promise((solv) => solv(new BranchNotFoundError()))
      );
      await (await request(mock(head)))
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect(404);
    });

    it("should return 500 if promise is rejected", async () => {
      const head = jest.fn(() => new Promise((_, rej) => rej("fooey")));
      await (await request(mock(head)))
        .get("/v1/testorg/testrepo/testbranch.html")
        .expect(500);
    });
  });

  describe("GET /v1/:org/:repo/:branch.xml", () => {
    it("should retrieve the stored report file with the associated head commit", async () => {
      const head = jest.fn(
        () =>
          new Promise((solv) =>
            solv({ commit: "testcommit", format: "cobertura" })
          )
      );
      const mockMeta = mock(head);
      const res = await (await request(mockMeta))
        .get("/v1/testorg/testrepo/testbranch.xml")
        .expect("Content-Type", /xml/)
        .expect(200);
      const buffer = await fs.promises.readFile(coberturaReport);

      expect(mockMeta.getHeadCommit).toHaveBeenCalledTimes(1);
      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should retrieve the marked format as stored in metadata", async () => {
      const head = jest.fn(
        () =>
          new Promise((solv) =>
            solv({ commit: "testcommit", format: "tarpaulin" })
          )
      );
      const mockMeta = mock(head);
      // request XML, get HTML
      const res = await (await request(mockMeta))
        .get("/v1/testorg/testrepo/testbranch.xml")
        .expect("Content-Type", /html/)
        .expect(200);
      const buffer = await fs.promises.readFile(tarpaulinReport);

      expect(mockMeta.getHeadCommit).toHaveBeenCalledTimes(1);
      expect(res.text).toEqual(buffer.toString("utf-8"));
    });

    it("should return 404 if file does not exist", async () => {
      await (await request()).get("/v1/neorg/nerepo/nebranch.xml").expect(404);
    });

    it("should return 404 if head commit not found", async () => {
      const head = jest.fn(
        () => new Promise((solv) => solv(new BranchNotFoundError()))
      );
      await (await request(mock(head)))
        .get("/v1/testorg/testrepo/testbranch.xml")
        .expect(404);
    });

    it("should return 500 if promise is rejected", async () => {
      const head = jest.fn(() => new Promise((_, rej) => rej("fooey")));
      await (await request(mock(head)))
        .get("/v1/testorg/testrepo/testbranch.xml")
        .expect(500);
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
    it("should retrieve the stored report badge with the associated head commit", async () => {
      const mockMeta = mock();
      const res = await (await request(mockMeta))
        .get("/v1/testorg/testrepo/testbranch.svg")
        .expect("Content-Type", /svg/)
        .expect(200);

      expect(mockMeta.getHeadCommit).toHaveBeenCalledTimes(1);
      expect(res.body.toString("utf-8")).toEqual(fakeBadge);
    });

    it("should return 404 if file does not exist", async () => {
      await (await request()).get("/v1/neorg/nerepo/nebranch.svg").expect(404);
    });

    it("should return 404 if head commit not found", async () => {
      const head = jest.fn(
        () => new Promise((solv) => solv(new BranchNotFoundError()))
      );
      await (await request(mock(head)))
        .get("/v1/testorg/testrepo/testbranch.svg")
        .expect(404);
    });

    it("should return 500 if promise is rejected", async () => {
      const head = jest.fn(() => new Promise((_, rej) => rej("fooey")));
      await (await request(mock(head)))
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
    const data = fs.promises.readFile(
      path.join(__dirname, "..", "example_reports", "tarpaulin-report.html")
    );

    it("should upload the report and generate a badge", async () => {
      const mockMeta = mock();
      await (
        await request(mockMeta)
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${config.token}&format=tarpaulin`
        )
        .send(await data)
        .expect(200);

      expect(mockMeta.updateBranch).toBeCalledWith({
        organization: "testorg",
        repository: "testrepo",
        branch: "newthis",
        head: { commit: "newthat", format: "tarpaulin" },
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
          `/v1/testorg/testrepo/newthis/newthat.html?token=${config.token}&format=pepperoni`
        )
        .send(await data)
        .expect(406);
    });

    it("should return 400 when request body is not the appropriate format", async () => {
      await (await request())
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${config.token}&format=tarpaulin`
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
          `/v1/testorg/testrepo/newthis/newthat.html?token=${config.token}&format=tarpaulin`
        )
        .send(bigData)
        .expect(413);
    });

    it("should return 500 when Metadata does not create branch", async () => {
      const update = jest.fn(() => new Promise((solv) => solv(false)));
      await (
        await request(mock(jest.fn(), update))
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${config.token}&format=tarpaulin`
        )
        .send(await data)
        .expect(500);
    });

    it("should return 500 when promise chain is rejected", async () => {
      const update = jest.fn(() => new Promise((_, rej) => rej("fooey 2")));
      await (
        await request(mock(jest.fn(), update))
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.html?token=${config.token}&format=tarpaulin`
        )
        .send(await data)
        .expect(500);
    });
  });

  describe("POST /v1/:org/:repo/:branch/:commit.xml", () => {
    const data = fs.promises.readFile(
      path.join(__dirname, "..", "example_reports", "cobertura-report.xml")
    );

    it("should upload the report and generate a badge", async () => {
      const mockMeta = mock();
      await (
        await request(mockMeta)
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${config.token}&format=cobertura`
        )
        .send(await data)
        .expect(200);

      expect(mockMeta.updateBranch).toBeCalledWith({
        organization: "testorg",
        repository: "testrepo",
        branch: "newthis",
        head: { commit: "newthat", format: "cobertura" },
      });
      expect(mockMeta.updateBranch).toHaveBeenCalledTimes(1);
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
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${config.token}&format=pepperoni`
        )
        .send(await data)
        .expect(406);
    });

    it("should return 400 when request body is not the appropriate format", async () => {
      await (await request())
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${config.token}&format=cobertura`
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
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${config.token}&format=cobertura`
        )
        .send(bigData)
        .expect(413);
    });

    it("should return 500 when Metadata does not create branch", async () => {
      const update = jest.fn(() => new Promise((solv) => solv(false)));
      await (
        await request(mock(jest.fn(), update))
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${config.token}&format=cobertura`
        )
        .send(await data)
        .expect(500);
    });

    it("should return 500 when promise chain is rejected", async () => {
      const update = jest.fn(() => new Promise((_, rej) => rej("fooey 2")));
      await (
        await request(mock(jest.fn(), update))
      )
        .post(
          `/v1/testorg/testrepo/newthis/newthat.xml?token=${config.token}&format=cobertura`
        )
        .send(await data)
        .expect(500);
    });
  });
});
