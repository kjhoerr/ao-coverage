const exit = jest
  .spyOn(process, "exit")
  .mockImplementation(() => undefined as never);

import {
  configOrError,
  persistTemplate,
  handleStartup,
  handleShutdown
} from "./config";
import { MongoClient, MongoError } from "mongodb";
import { Server } from "http";
import path from "path";
import fs from "fs";
import * as templates from "../templates";

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
  eventNames: jest.fn()
};

const MongoMock = (p: Promise<void>): jest.Mock<MongoClient, void[]> =>
  jest.fn<MongoClient, void[]>(() => ({
    ...CommonMocks,
    close: jest.fn(() => p),
    db: jest.fn()
  }));
const ServerMock = (mockErr: Error | undefined): jest.Mock<Server, void[]> =>
  jest.fn<Server, void[]>(() => ({
    ...CommonMocks,
    connections: 0,
    setTimeout: jest.fn(),
    timeout: 0,
    headersTimeout: 0,
    keepAliveTimeout: 0,
    close: function(c: (err?: Error | undefined) => void): Server {
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
    unref: jest.fn()
  }));

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
      context: { EXAMPLE: "this" }
    } as templates.Template;
    const processTemplate = jest
      .spyOn(templates, "default")
      .mockImplementation(
        (template: templates.Template) => new Promise(res => res(template))
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
      context: { EXAMPLE: "this" }
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
      context: { EXAMPLE: "this" }
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

  it("should pass back MongoClient", async () => {
    const superClient = {} as MongoClient;
    const fsAccess = jest.spyOn(fs.promises, "access").mockResolvedValue();
    const pathAbsolute = jest.spyOn(path, "isAbsolute").mockReturnValue(true);
    const pathJoin = jest.spyOn(path, "join").mockReturnValue("path");
    const mongoClient = jest.spyOn(MongoClient, "connect").mockImplementation(
      () => new Promise<MongoClient>(res => res(superClient))
    );
    const processTemplate = jest
      .spyOn(templates, "default")
      .mockImplementation(
        (template: templates.Template) => new Promise(res => res(template))
      );

    const result = await handleStartup();

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
    const fsAccess = jest.spyOn(fs.promises, "access").mockRejectedValue("boo");
    const pathAbsolute = jest.spyOn(path, "isAbsolute").mockReturnValue(true);
    const pathJoin = jest.spyOn(path, "join").mockReturnValue("path");

    const result = await handleStartup();

    expect(fsAccess).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(pathAbsolute).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
    pathAbsolute.mockRestore();
    pathJoin.mockRestore();
    fsAccess.mockRestore();
  });

  it("should exit if HOST_DIR is not absolute path", async () => {
    const superClient = {} as MongoClient;
    const fsAccess = jest.spyOn(fs.promises, "access").mockResolvedValue();
    const pathAbsolute = jest.spyOn(path, "isAbsolute").mockReturnValue(false);
    const pathJoin = jest.spyOn(path, "join").mockReturnValue("path");
    const mongoClient = jest.spyOn(MongoClient, "connect").mockImplementation(
      () => new Promise<MongoClient>(res => res(superClient))
    );

    await handleStartup();

    expect(pathAbsolute).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
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
        (template: templates.Template) => new Promise(res => res(template))
      );

    await handleStartup();

    expect(mongoClient).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
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
    const mongo = MongoMock(new Promise(r => r()))();
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
    const mongo = MongoMock(new Promise(r => r()))();
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
