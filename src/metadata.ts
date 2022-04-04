import { Db } from "mongodb";
import winston from "winston";

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
  /** The application server token to serve as user self-identifier */
  token: string;
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
  database: Db;
  config: EnvConfig;
  logger: winston.Logger;

  constructor(client: Db, data: EnvConfig) {
    this.logger = winston.createLogger(loggerConfig("META", data.logLevel));
    this.database = client;
    this.config = data;
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
   * Retrieve the application token from configuration
   */
  getToken(): string {
    return this.config.token;
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
