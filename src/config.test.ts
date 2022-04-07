const exit = jest
  .spyOn(process, "exit")
  .mockImplementation(() => undefined as never);

import winston from "winston";
import {
  configOrError,
  persistTemplate,
  handleStartup,
  handleShutdown,
} from "./config";
import { MongoClient, MongoError } from "mongodb";
import { Server } from "http";
import path from "path";
import fs from "fs";

import loggerConfig from "./util/logger";
import * as templates from "./templates";
import Metadata, { EnvConfig } from "./metadata";

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

const LOGGER = winston.createLogger(loggerConfig("TEST", "debug"));

describe("configOrError", () => {
  beforeEach(() => {
    exit.mockClear();
  });

  it("should exit when a env var does not exist", () => {
    // Arrange

    // Act
    let result;
    try {
      result = configOrError("APPLESAUCE", LOGGER);
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
    const result = configOrError("CHRYSANTHEMUM", LOGGER);

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

    await persistTemplate(template, LOGGER);

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

    await persistTemplate(template, LOGGER);

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

    await persistTemplate(template, LOGGER);

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
    dbUri: "localhost:27017",
    dbName: "bongo",
    targetUrl: "localhost",
    logLevel: "trace",
  } as EnvConfig;
  const confStartup = (): Promise<Metadata> =>
    handleStartup(config, undefined, LOGGER);

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
    const metadata = {
      close: () => Promise.resolve(),
    } as Metadata;
    const server = {
      close: (callback?: ((err?: Error | undefined) => void) | undefined) => {
        callback !== undefined && callback();
      },
    } as Server;

    // Act
    try {
      await handleShutdown(metadata, server, LOGGER)("SIGINT");
    } catch (err) {
      //
    }

    // Assert
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("should exit with error with Metadata error", async () => {
    // Arrange
    const metadata = {
      close: () => Promise.reject(),
    } as Metadata;
    const server = {
      close: (callback?: ((err?: Error | undefined) => void) | undefined) => {
        callback !== undefined && callback();
      },
    } as Server;

    // Act
    try {
      await handleShutdown(metadata, server, LOGGER)("SIGINT");
    } catch (err) {
      //
    }

    // Assert
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("should exit with error with Server error", async () => {
    // Arrange
    const metadata = {
      close: () => Promise.resolve(),
    } as Metadata;
    const server = {
      close: (callback?: ((err?: Error | undefined) => void) | undefined) => {
        callback !== undefined && callback(Error("NOOO"));
      },
    } as Server;

    // Act
    try {
      await handleShutdown(metadata, server, LOGGER)("SIGINT");
    } catch (err) {
      //
    }

    // Assert
    expect(exit).toHaveBeenCalledWith(1);
  });
});
