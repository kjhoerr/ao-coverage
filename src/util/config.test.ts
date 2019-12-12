import { configOrError, handleShutdown } from "./config";
import { MongoClient } from "mongodb";
import { Server } from "http";

const exit = jest.spyOn(process, "exit").mockImplementation(() => {
  throw Error("");
});

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
    expect(exit).toHaveBeenCalledWith(1);
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
