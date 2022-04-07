import { Db, MongoClient, Collection } from "mongodb";
import { Writable } from "stream";
import winston from "winston";
import { BranchNotFoundError } from "./errors";
import Metadata, { isError, EnvConfig, HeadIdentity } from "./metadata";
jest.mock("mongodb");

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

const defaultEnvConfig = {
  uploadLimit: 12,
  hostDir: "pineapple",
  publicDir: ".dir",
  stage1: 132,
  stage2: 1.0,
};
const defaultMetadata = () => {
  jest
    .spyOn(MongoClient.prototype, "db")
    .mockImplementation(() => new Db({} as MongoClient, ""));
  return new Metadata(new MongoClient(""), defaultEnvConfig as EnvConfig);
};

describe("isError", () => {
  it("should return false when object is a HeadContext", () => {
    // Arrange
    const obj = {
      commit: "fae10429d",
      format: "15-minute quarters",
    };

    // Act
    const result = isError(obj);

    // Assert
    expect(result).toEqual(false);
  });

  it("should return true when object is a BranchNotFoundError", () => {
    // Arrange
    const error = new BranchNotFoundError();

    // Act
    const result = isError(error);

    // Assert
    expect(result).toEqual(true);
  });
});

describe("getHeadCommit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return commit information if the repository exists and branch is a string", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const organization = "kjhoerr";
    const repository = "ao-coverage";
    const branch = "aaaaa";
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const repositoryObject = {
      value: "repository",
      branches: { [branch]: { head: "yay" } },
    };
    const findMethod = jest
      .spyOn(Collection.prototype, "findOne")
      .mockImplementation(() => Promise.resolve(repositoryObject));

    // Act
    const result = await metadata.getHeadCommit(
      organization,
      repository,
      branch
    );

    // Assert
    expect(isError(result)).toEqual(false);
    expect(collectionMethod).toHaveBeenCalledTimes(1);
    expect(findMethod).toHaveBeenCalledTimes(1);
    if (!isError(result)) {
      expect(result.commit).toEqual(repositoryObject.branches[branch].head);
      expect(result.format).toEqual("tarpaulin");
    }
  });

  it("should return commit information if the repository exists and branch is a HeadContext", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const organization = "kjhoerr";
    const repository = "ao-coverage";
    const branch = "aaaaa";
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const headContext = { commit: "yay", format: "big-stick" };
    const repositoryObject = {
      value: "repository",
      branches: { [branch]: { head: headContext } },
    };
    const findMethod = jest
      .spyOn(Collection.prototype, "findOne")
      .mockImplementation(() => Promise.resolve(repositoryObject));

    // Act
    const result = await metadata.getHeadCommit(
      organization,
      repository,
      branch
    );

    // Assert
    expect(isError(result)).toEqual(false);
    expect(collectionMethod).toHaveBeenCalledTimes(1);
    expect(findMethod).toHaveBeenCalledTimes(1);
    if (!isError(result)) {
      expect(result.commit).toEqual(headContext.commit);
      expect(result.format).toEqual(headContext.format);
    }
  });

  it("should return BranchNotFoundError if the repository exists but the branch does not exist", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const organization = "kjhoerr";
    const repository = "ao-coverage";
    const branch = "aaaaa";
    const fakeBranch = "main";
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const repositoryObject = {
      value: "repository",
      branches: { [fakeBranch]: { head: "yep" } },
    };
    const findMethod = jest
      .spyOn(Collection.prototype, "findOne")
      .mockImplementation(() => Promise.resolve(repositoryObject));

    // Act
    const result = await metadata.getHeadCommit(
      organization,
      repository,
      branch
    );

    // Assert
    expect(fakeBranch).not.toEqual(branch);
    expect(isError(result)).toEqual(true);
    expect(collectionMethod).toHaveBeenCalledTimes(1);
    expect(findMethod).toHaveBeenCalledTimes(1);
  });

  it("should return BranchNotFoundError if the repository does not exist", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const organization = "kjhoerr";
    const repository = "ao-coverage";
    const branch = "aaaaa";
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const findMethod = jest
      .spyOn(Collection.prototype, "findOne")
      .mockImplementation(() => Promise.resolve(null));

    // Act
    const result = await metadata.getHeadCommit(
      organization,
      repository,
      branch
    );

    // Assert
    expect(isError(result)).toEqual(true);
    expect(collectionMethod).toHaveBeenCalledTimes(1);
    expect(findMethod).toHaveBeenCalledTimes(1);
  });

  it("should return with rejected promise on Mongo error", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const organization = "kjhoerr";
    const repository = "ao-coverage";
    const branch = "aaaaa";
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const findMethod = jest
      .spyOn(Collection.prototype, "findOne")
      .mockImplementation(() => Promise.reject("uh-oh"));

    // Act
    const result = metadata.getHeadCommit(organization, repository, branch);

    // Assert
    expect(result).rejects.toEqual("uh-oh");
    expect(collectionMethod).toHaveBeenCalledTimes(1);
    expect(findMethod).toHaveBeenCalledTimes(1);
  });
});

describe("updateBranch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should update the repository with new branch information", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const updateMethod = jest
      .spyOn(Collection.prototype, "findOneAndUpdate")
      .mockImplementation(() =>
        Promise.resolve({ ok: 1, value: "repository" })
      );
    const insertMethod = jest
      .spyOn(Collection.prototype, "insertOne")
      .mockImplementation(() => Promise.resolve({ acknowledged: true }));
    const identity: HeadIdentity = {
      organization: "kjhoerr",
      repository: "ao-coverage",
      branch: "trunk",
      head: {
        commit: "yep",
        format: "xml",
      },
    };

    // Act
    const result = await metadata.updateBranch(identity);

    // Assert
    expect(result).toEqual(true);
    expect(collectionMethod).toHaveBeenCalledTimes(1);
    expect(updateMethod).toHaveBeenCalledTimes(1);
    expect(insertMethod).not.toHaveBeenCalled();
    const document = updateMethod.mock.calls[0][0];
    expect(document.organization).toEqual(identity.organization);
    expect(document.name).toEqual(identity.repository);
  });

  it("should call create repository if it does not exist yet", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const updateMethod = jest
      .spyOn(Collection.prototype, "findOneAndUpdate")
      .mockImplementation(() => Promise.resolve({}));
    const insertMethod = jest
      .spyOn(Collection.prototype, "insertOne")
      .mockImplementation(() => Promise.resolve({ acknowledged: true }));
    const identity: HeadIdentity = {
      organization: "kjhoerr",
      repository: "ao-coverage",
      branch: "trunk",
      head: {
        commit: "yep",
        format: "xml",
      },
    };

    // Act
    const result = await metadata.updateBranch(identity);

    // Assert
    expect(result).toEqual(true);
    expect(collectionMethod).toHaveBeenCalledTimes(2);
    expect(updateMethod).toHaveBeenCalledTimes(1);
    // Metadata.createRepository was called
    expect(insertMethod).toHaveBeenCalledTimes(1);
  });

  it("should return with rejected promise on Mongo error", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const updateMethod = jest
      .spyOn(Collection.prototype, "findOneAndUpdate")
      .mockImplementation(() => Promise.reject("Success!!!!!!!!"));
    const insertMethod = jest
      .spyOn(Collection.prototype, "insertOne")
      .mockImplementation(() => Promise.resolve({ acknowledged: true }));
    const identity: HeadIdentity = {
      organization: "kjhoerr",
      repository: "ao-coverage",
      branch: "trunk",
      head: {
        commit: "yep",
        format: "xml",
      },
    };

    // Act
    const result = metadata.updateBranch(identity);

    // Assert
    expect(result).rejects.toEqual("Success!!!!!!!!");
    expect(collectionMethod).toHaveBeenCalledTimes(1);
    expect(updateMethod).toHaveBeenCalledTimes(1);
    expect(insertMethod).not.toHaveBeenCalled();
  });
});

describe("createRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true upon adding a new repository document", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const insertMethod = jest
      .spyOn(Collection.prototype, "insertOne")
      .mockImplementation(() => Promise.resolve({ acknowledged: true }));
    const identity: HeadIdentity = {
      organization: "kjhoerr",
      repository: "ao-coverage",
      branch: "trunk",
      head: {
        commit: "yep",
        format: "xml",
      },
    };

    // Act
    const result = await metadata.createRepository(identity);

    // Assert
    expect(result).toEqual(true);
    expect(collectionMethod).toHaveBeenCalledTimes(1);
    expect(insertMethod).toHaveBeenCalledTimes(1);
    const document = insertMethod.mock.calls[0][0];
    expect(document.organization).toEqual(identity.organization);
    expect(document.name).toEqual(identity.repository);
    expect(document.branches[identity.branch]).toBeDefined();
    const branch = document.branches[identity.branch];
    expect(branch.head).toEqual(identity.head);
  });

  it("should return with rejected promise on Mongo error", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const insertMethod = jest
      .spyOn(Collection.prototype, "insertOne")
      .mockImplementation(() => Promise.reject("fooey"));
    const identity: HeadIdentity = {
      organization: "kjhoerr",
      repository: "ao-coverage",
      branch: "trunk",
      head: {
        commit: "yep",
        format: "xml",
      },
    };

    // Act
    const result = metadata.createRepository(identity);

    // Assert
    expect(result).rejects.toEqual("fooey");
    expect(collectionMethod).toHaveBeenCalledTimes(1);
    expect(insertMethod).toHaveBeenCalledTimes(1);
  });
});

describe("initializeToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Should generate a UUID", async () => {
    // Arrange
    const metadata = defaultMetadata();
    const collectionMethod = jest
      .spyOn(Db.prototype, "collection")
      .mockImplementation(() => new Collection());
    const countMethod = jest
      .spyOn(Collection.prototype, "countDocuments")
      .mockImplementation(() => Promise.resolve(0));
    const replaceMethod = jest
      .spyOn(Collection.prototype, "findOneAndReplace")
      .mockImplementation(() => Promise.resolve({ ok: 1 }));
    output = "";

    // Act
    const result = await metadata.initializeToken();

    // Assert
    expect(result).toEqual(true);
    expect(output).toMatch(/([a-f0-9]{8}(-[a-f0-9]{4}){4}[a-f0-9]{8})/);
    expect(collectionMethod).toHaveBeenCalledTimes(2);
    expect(countMethod).toHaveBeenCalledTimes(1);
    expect(replaceMethod).toHaveBeenCalledTimes(1);
  });
});

describe("getUploadLimit", () => {
  it("should return the uploadLimit from EnvConfig", () => {
    // Arrange
    const metadata = defaultMetadata();

    // Act
    const result = metadata.getUploadLimit();

    // Assert
    expect(result).toEqual(defaultEnvConfig.uploadLimit);
  });
});

describe("getHostDir", () => {
  it("should return the hostDir from EnvConfig", () => {
    // Arrange
    const metadata = defaultMetadata();

    // Act
    const result = metadata.getHostDir();

    // Assert
    expect(result).toEqual(defaultEnvConfig.hostDir);
  });
});

describe("getPublicDir", () => {
  it("should return the publicDir from EnvConfig", () => {
    // Arrange
    const metadata = defaultMetadata();

    // Act
    const result = metadata.getPublicDir();

    // Assert
    expect(result).toEqual(defaultEnvConfig.publicDir);
  });
});

describe("getGradientStyle", () => {
  it("should return the stages for GradientStyle from EnvConfig", () => {
    // Arrange
    const metadata = defaultMetadata();

    // Act
    const result = metadata.getGradientStyle();

    // Assert
    expect(result.stage1).toEqual(defaultEnvConfig.stage1);
    expect(result.stage2).toEqual(defaultEnvConfig.stage2);
  });
});
