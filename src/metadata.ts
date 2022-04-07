import { Db, MongoClient } from "mongodb";
import winston from "winston";
import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";

import loggerConfig from "./util/logger";
import { BranchNotFoundError } from "./errors";
import { GradientStyle } from "./formats";

interface HeadContext {
  commit: string;
  format: string;
}

interface Branch {
  head: HeadContext | string;
}

interface BranchList {
  [branch: string]: Branch;
}

interface SystemConfig {
  tokenHashed: string;
}

export interface HeadIdentity {
  organization: string;
  repository: string;
  branch: string;
  head: HeadContext;
}

export interface Repository {
  organization: string;
  name: string;
  branches: BranchList;
}

/**
 * Holds environment configuration items for the application
 */
export interface EnvConfig {
  /** Express value to bind to a given address */
  bindAddress: string;
  /** Express value for port */
  port: number;
  /** Express value to limit uploads to server */
  uploadLimit: number;
  /** Configuration for the database name */
  dbName: string;
  /** Configuration for the database URI */
  dbUri: string;
  /** The address given for communicating back to the server */
  targetUrl: string;
  /** The host directory for uploaded files */
  hostDir: string;
  /** The public directory for static files */
  publicDir: string;
  /** Gradient setting 1 */
  stage1: number;
  /** Gradient setting 2 */
  stage2: number;
  /** Log level across application */
  logLevel: string;
}

/**
 * Check if provided response is a known application error
 */
export const isError = (
  obj: HeadContext | BranchNotFoundError
): obj is BranchNotFoundError => {
  return Object.keys(obj).includes("name");
};

/**
 * Handles data routing for application
 */
class Metadata {
  private dbClient: MongoClient;
  private database: Db;
  config: EnvConfig;
  logger: winston.Logger;

  constructor(client: MongoClient, data: EnvConfig) {
    this.dbClient = client;
    this.database = client.db(data.dbName);
    this.config = data;
    this.logger = winston.createLogger(loggerConfig("META", data.logLevel));
  }

  async close(): Promise<void> {
    await this.dbClient.close();
    this.logger.info("Database client connection closed.");
  }

  /**
   * Retrieve the latest commit to the given branch
   */
  async getHeadCommit(
    organization: string,
    repository: string,
    branch: string
  ): Promise<HeadContext | BranchNotFoundError> {
    const result = await this.database
      .collection<Repository>("repository")
      .findOne({
        organization,
        name: repository,
        ["branches." + branch]: { $exists: true, $ne: null },
      });

    if (result !== null && Object.keys(result.branches).includes(branch)) {
      const limb = result.branches[branch];
      const head = typeof limb.head === "string" ? limb.head : limb.head.commit;
      const format =
        typeof limb.head === "string" ? "tarpaulin" : limb.head.format;
      this.logger.debug(
        "Found commit %s for ORB %s/%s/%s (format %s)",
        head,
        organization,
        repository,
        branch,
        format
      );
      return { commit: head, format };
    } else {
      return new BranchNotFoundError();
    }
  }

  /**
   * Update the database with the latest commit to a branch
   */
  async updateBranch(identity: HeadIdentity): Promise<boolean> {
    const { organization, repository: name, branch, head } = identity;
    const result = await this.database
      .collection<Repository>("repository")
      .findOneAndUpdate(
        { organization, name },
        { $set: { ["branches." + branch]: { head } } }
      );

    if (result.value == null) {
      return this.createRepository(identity);
    }

    return result.ok === 1;
  }

  /**
   * Add a repository metadata document to the database
   */
  async createRepository(identity: HeadIdentity): Promise<boolean> {
    const { organization, repository: name, branch, head } = identity;
    const repo: Repository = {
      organization,
      name,
      branches: { [branch]: { head } },
    };

    const result = await this.database
      .collection<Repository>("repository")
      .insertOne(repo);

    return result.acknowledged;
  }

  /**
   * Check whether the provided token matches the hashed token
   */
  async checkToken(token: string): Promise<boolean> {
    const result = await this.database
      .collection<SystemConfig>("sysconfig")
      .findOne({});

    if (result !== null) {
      return bcrypt.compare(token, result.tokenHashed);
    } else {
      return Promise.reject(Error("No system configuration in place"));
    }
  }

  /**
   * Generate a token for use as the user self-identifier.
   *
   * If the token is passed after it already exists, it will be overwritten.
   */
  async initializeToken(token?: string | undefined): Promise<boolean> {
    const config = await this.database
      .collection<SystemConfig>("sysconfig")
      .countDocuments();

    if (config > 0 && token === undefined) {
      return true;
    }

    const useToken =
      token === undefined
        ? (() => {
            const newToken = uuid();

            this.logger.warn(
              "TOKEN variable not provided, using this value instead: %s",
              newToken
            );
            this.logger.warn(
              "Use this provided token to push your coverage reports to the server."
            );

            return newToken;
          })()
        : token;

    const sysconfig = {
      tokenHashed: await bcrypt.hash(useToken, 10),
    };

    const result = await this.database
      .collection<SystemConfig>("sysconfig")
      .findOneAndReplace({}, sysconfig, { upsert: true });

    return result.ok === 1;
  }

  /**
   * Retrieve the upload limit for files from configuration
   */
  getUploadLimit(): number {
    return this.config.uploadLimit;
  }

  /**
   * Retrieve the host for uploaded documents directory from configuration
   */
  getHostDir(): string {
    return this.config.hostDir;
  }

  /**
   * Retrieve the public static file directory from configuration
   */
  getPublicDir(): string {
    return this.config.publicDir;
  }

  /**
   * Retrieve the gradient style from configuration
   */
  getGradientStyle(): GradientStyle {
    return {
      stage1: this.config.stage1,
      stage2: this.config.stage2,
    };
  }
}

export default Metadata;
