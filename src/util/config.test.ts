const exit = jest
  .spyOn(process, "exit")
  .mockImplementation(() => undefined as never);

import { Writable } from "stream";
import winston from "winston";

let output = "";

jest.mock("./logger", () => {
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

import {
  configOrError,
  persistTemplate,
  handleStartup,
  handleShutdown,
  initializeToken,
} from "./config";
import {
  Logger,
  MongoClient,
  MongoError,
  ReadConcern,
  ReadPreference,
  WriteConcern,
} from "mongodb";
import { Server } from "http";
import path from "path";
import fs from "fs";
import * as templates from "../templates";
import { EnvConfig } from "../metadata";

const CommonMocks = {
  connect: jest.fn(),
  isConnected: jest.fn(),
  logout: jest.fn(),
  watch: jest.fn(),
  startSession: jest.fn(),
  withSession: jest.fn(),
  addListener: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  prependListener: jest.fn(),
  prependOnceListener: jest.fn(),
  removeAllListeners: jest.fn(),
  removeListener: jest.fn(),
  off: jest.fn(),
  setMaxListeners: jest.fn(),
  getMaxListeners: jest.fn(),
  listeners: jest.fn(),
  listenerCount: jest.fn(),
  rawListeners: jest.fn(),
  emit: jest.fn(),
  eventNames: jest.fn(),
};

const MongoMock = (p: Promise<void>): jest.Mock<MongoClient, void[]> =>
  jest.fn<MongoClient, void[]>(() => ({
    ...CommonMocks,
    close: jest.fn(() => p),
    readPreference: ReadPreference.nearest,
    bsonOptions: {},
    logger: new Logger("a"),
    getLogger: jest.fn(),
    options: {
      hosts: [],
      readPreference: ReadPreference.nearest,
      readConcern: new ReadConcern("local"),
      loadBalanced: true,
      serverApi: { version: "1" },
      compressors: [],
      writeConcern: new WriteConcern(),
      dbName: "",
      metadata: {
        driver: { name: "", version: "" },
        os: { type: "", name: "linux", architecture: "", version: "" },
        platform: "linx",
      },
      tls: true,
      toURI: jest.fn(),
      autoEncryption: {},
      connectTimeoutMS: 0,
      directConnection: true,
      driverInfo: {},
      forceServerObjectId: true,
      minHeartbeatFrequencyMS: 0,
      heartbeatFrequencyMS: 0,
      keepAlive: false,
      keepAliveInitialDelay: 0,
      localThresholdMS: 0,
      logger: new Logger("a"),
      maxIdleTimeMS: 0,
      maxPoolSize: 0,
      minPoolSize: 0,
      monitorCommands: true,
      noDelay: true,
      pkFactory: { createPk: jest.fn() },
      promiseLibrary: {},
      raw: true,
      replicaSet: "",
      retryReads: true,
      retryWrites: true,
      serverSelectionTimeoutMS: 0,
      socketTimeoutMS: 0,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      tlsInsecure: false,
      waitQueueTimeoutMS: 0,
      zlibCompressionLevel: 0,
    },
    serverApi: { version: "1" },
    autoEncrypter: undefined,
    readConcern: new ReadConcern("local"),
    writeConcern: new WriteConcern(),
    db: jest.fn(),
  }));
const ServerMock = (mockErr: Error | undefined): jest.Mock<Server, void[]> =>
  jest.fn<Server, void[]>(() => ({
    ...CommonMocks,
    connections: 0,
    setTimeout: jest.fn(),
    timeout: 0,
    headersTimeout: 0,
    keepAliveTimeout: 0,
    close: function (c: (err?: Error | undefined) => void): Server {
      c(mockErr);
      return this;
    },
    maxHeadersCount: 0,
    maxConnections: 0,
    listen: jest.fn(),
    listening: true,
    address: jest.fn(),
    getConnections: jest.fn(),
    ref: jest.fn(),
    requestTimeout: 3600,
    unref: jest.fn(),
  }));

describe("initializeToken", () => {
  it("Should generate a UUID", () => {
    // Arrange
    output = "";

    // Act
    const result = initializeToken();

    // Assert
    expect(result).toMatch(/([a-f0-9]{8}(-[a-f0-9]{4}){4}[a-f0-9]{8})/);
    expect(output).toContain(result);
  });
});

describe("configOrError", () => {
  beforeEach(() => {
    exit.mockClear();
  });

  it("should exit when a env var does not exist", () => {
    // Arrange

    // Act
    let result;
    try {
      result = configOrError("APPLESAUCE");
    } catch (err) {
      //
    }

    // Assert
    expect(result).toBeUndefined();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should return the expected env var", () => {
    // Arrange
    process.env.CHRYSANTHEMUM = "hello";

    // Act
    const result = configOrError("CHRYSANTHEMUM");

    // Assert
    expect(result).toEqual(process.env.CHRYSANTHEMUM);
    expect(exit).toHaveBeenCalledTimes(0);
  });
});

describe("persistTemplate", () => {
  beforeEach(() => {
    exit.mockClear();
  });

  it("should generate a template without error", async () => {
    const template = {
      inputFile: "/mnt/c/Windows/System32",
      outputFile: "./helloworld.txt",
      context: { EXAMPLE: "this" },
    } as templates.Template;
    const processTemplate = jest
      .spyOn(templates, "default")
      .mockImplementation(
        (template: templates.Template) => new Promise((res) => res(template))
      );
    const fsAccess = jest.spyOn(fs.promises, "access").mockResolvedValue();

    await persistTemplate(template);

    expect(processTemplate).toHaveBeenCalledWith(template);
    expect(fsAccess).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    processTemplate.mockRestore();
    fsAccess.mockRestore();
  });

  it("should exit without error if template does not generate but file already exists", async () => {
    const template = {
      inputFile: "/mnt/c/Windows/System32",
      outputFile: "./helloworld.txt",
      context: { EXAMPLE: "this" },
    } as templates.Template;
    const processTemplate = jest
      .spyOn(templates, "default")
      .mockRejectedValue("baa");
    const fsAccess = jest.spyOn(fs.promises, "access").mockResolvedValue();

    await persistTemplate(template);

    expect(processTemplate).toHaveBeenCalledWith(template);
    expect(fsAccess).toHaveBeenCalledWith(
      template.outputFile,
      fs.constants.R_OK
    );
    expect(exit).not.toHaveBeenCalled();
    processTemplate.mockRestore();
    fsAccess.mockRestore();
  });

  it("should exit with error if template does not generate and file does not exist", async () => {
    const template = {
      inputFile: "/mnt/c/Windows/System32",
      outputFile: "./helloworld.txt",
      context: { EXAMPLE: "this" },
    } as templates.Template;
    const processTemplate = jest
      .spyOn(templates, "default")
      .mockRejectedValue("baz");
    const fsAccess = jest.spyOn(fs.promises, "access").mockRejectedValue("bar");

    await persistTemplate(template);

    expect(processTemplate).toHaveBeenCalledWith(template);
    expect(fsAccess).toHaveBeenCalledWith(
      template.outputFile,
      fs.constants.R_OK
    );
    expect(exit).toHaveBeenCalledWith(1);
    processTemplate.mockRestore();
    fsAccess.mockRestore();
  });
});

describe("handleStartup", () => {
  beforeEach(() => {
    exit.mockClear();
  });

  const config = {
    hostDir: "/apple",
    publicDir: "/public",
  } as EnvConfig;
  const confStartup = (): Promise<MongoClient> =>
    handleStartup("", config, "localhost");

  it("should pass back MongoClient", async () => {
    const superClient = {} as MongoClient;
    const fsAccess = jest.spyOn(fs.promises, "access").mockResolvedValue();
    const pathAbsolute = jest.spyOn(path, "isAbsolute").mockReturnValue(true);
    const pathJoin = jest.spyOn(path, "join").mockReturnValue("path");
    const mongoClient = jest
      .spyOn(MongoClient, "connect")
      .mockImplementation(
        () => new Promise<MongoClient>((res) => res(superClient))
      );
    const processTemplate = jest
      .spyOn(templates, "default")
      .mockImplementation(
        (template: templates.Template) => new Promise((res) => res(template))
      );

    const result = await confStartup();

    expect(fsAccess).toHaveBeenCalledTimes(1);
    expect(pathAbsolute).toHaveBeenCalledTimes(1);
    expect(mongoClient).toHaveBeenCalledTimes(1);
    expect(processTemplate).toHaveBeenCalledTimes(2);
    expect(exit).not.toHaveBeenCalled();
    expect(result).toEqual(superClient);
    processTemplate.mockRestore();
    mongoClient.mockRestore();
    pathAbsolute.mockRestore();
    pathJoin.mockRestore();
    fsAccess.mockRestore();
  });

  it("should exit if HOST_DIR is not read/write accessible", async () => {
    const superClient = {} as MongoClient;
    const fsAccess = jest.spyOn(fs.promises, "access").mockRejectedValue("boo");
    const pathAbsolute = jest.spyOn(path, "isAbsolute").mockReturnValue(true);
    const pathJoin = jest.spyOn(path, "join").mockReturnValue("path");
    const mongoClient = jest
      .spyOn(MongoClient, "connect")
      .mockImplementation(
        () => new Promise<MongoClient>((res) => res(superClient))
      );
    const processTemplate = jest
      .spyOn(templates, "default")
      .mockImplementation(
        (template: templates.Template) => new Promise((res) => res(template))
      );

    const result = await confStartup();

    expect(fsAccess).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(pathAbsolute).not.toHaveBeenCalled();
    expect(mongoClient).not.toHaveBeenCalled();
    expect(processTemplate).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
    processTemplate.mockRestore();
    mongoClient.mockRestore();
    pathAbsolute.mockRestore();
    pathJoin.mockRestore();
    fsAccess.mockRestore();
  });

  it("should exit if HOST_DIR is not absolute path", async () => {
    const superClient = {} as MongoClient;
    const fsAccess = jest.spyOn(fs.promises, "access").mockResolvedValue();
    const pathAbsolute = jest.spyOn(path, "isAbsolute").mockReturnValue(false);
    const pathJoin = jest.spyOn(path, "join").mockReturnValue("path");
    const mongoClient = jest
      .spyOn(MongoClient, "connect")
      .mockImplementation(
        () => new Promise<MongoClient>((res) => res(superClient))
      );
    const processTemplate = jest
      .spyOn(templates, "default")
      .mockImplementation(
        (template: templates.Template) => new Promise((res) => res(template))
      );

    const result = await confStartup();

    expect(fsAccess).toHaveBeenCalledTimes(1);
    expect(pathAbsolute).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(mongoClient).not.toHaveBeenCalled();
    expect(processTemplate).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
    processTemplate.mockRestore();
    mongoClient.mockRestore();
    pathAbsolute.mockRestore();
    pathJoin.mockRestore();
    fsAccess.mockRestore();
  });

  it("should exit if MongoClient has error", async () => {
    const fsAccess = jest.spyOn(fs.promises, "access").mockResolvedValue();
    const pathAbsolute = jest.spyOn(path, "isAbsolute").mockReturnValue(true);
    const pathJoin = jest.spyOn(path, "join").mockReturnValue("path");
    const mongoClient = jest
      .spyOn(MongoClient, "connect")
      .mockImplementation(
        () => new Promise((_, rej) => rej({ message: "aaahhh" } as MongoError))
      );
    const processTemplate = jest
      .spyOn(templates, "default")
      .mockImplementation(
        (template: templates.Template) => new Promise((res) => res(template))
      );

    const result = await confStartup();

    expect(fsAccess).toHaveBeenCalledTimes(1);
    expect(pathAbsolute).toHaveBeenCalledTimes(1);
    expect(mongoClient).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(processTemplate).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
    processTemplate.mockRestore();
    mongoClient.mockRestore();
    pathAbsolute.mockRestore();
    pathJoin.mockRestore();
    fsAccess.mockRestore();
  });
});

describe("handleShutdown", () => {
  beforeEach(() => {
    exit.mockClear();
    // we don't use the MongoMock or ServerMock to directly test, so no mockClear needed
  });

  it("should exit gracefully without error", async () => {
    // Arrange
    const mongo = MongoMock(new Promise((r) => r()))();
    const server = ServerMock(undefined)();

    // Act
    try {
      await handleShutdown(mongo, server)("SIGINT");
    } catch (err) {
      //
    }

    // Assert
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("should exit with error with Mongo error", async () => {
    // Arrange
    const mongo = MongoMock(new Promise((_, r) => r()))();
    const server = ServerMock(undefined)();

    // Act
    try {
      await handleShutdown(mongo, server)("SIGINT");
    } catch (err) {
      //
    }

    // Assert
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should exit with error with Server error", async () => {
    // Arrange
    const mongo = MongoMock(new Promise((r) => r()))();
    const server = ServerMock(Error("oh noooo"))();

    // Act
    try {
      await handleShutdown(mongo, server)("SIGINT");
    } catch (err) {
      //
    }

    // Assert
    expect(exit).toHaveBeenCalledWith(1);
  });
});
