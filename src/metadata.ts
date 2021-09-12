import { Db } from "mongodb";
import winston from "winston";

import loggerConfig from "./util/logger";
import { BranchNotFoundError } from "./errors";

interface Branch {
  head: string;
}

interface BranchList {
  [branch: string]: Branch;
}

export interface HeadIdentity {
  organization: string;
  repository: string;
  branch: string;
  head: string;
}

export interface Repository {
  organization: string;
  name: string;
  branches: BranchList;
}

const logger = winston.createLogger(loggerConfig("META"));

export interface EnvConfig {
  token: string;
  uploadLimit: number;
  hostDir: string;
  publicDir: string;
}

class Metadata {
  database: Db;
  config: EnvConfig;

  constructor(client: Db, data: EnvConfig) {
    this.database = client;
    this.config = data;
  }

  getToken(): string {
    return this.config.token;
  }

  getUploadLimit(): number {
    return this.config.uploadLimit;
  }

  getHostDir(): string {
    return this.config.hostDir;
  }

  getPublicDir(): string {
    return this.config.publicDir;
  }

  async getHeadCommit(
    organization: string,
    repository: string,
    branch: string
  ): Promise<string | BranchNotFoundError> {
    const result = await this.database
      .collection<Repository>("repository")
      .findOne({
        organization,
        name: repository,
        ["branches." + branch]: { $exists: true, $ne: null }
      });

    if (result !== null && Object.keys(result.branches).includes(branch)) {
      const limb = result.branches[branch];
      logger.debug(
        "Found commit %s for ORB %s/%s/%s",
        limb.head,
        organization,
        repository,
        branch
      );
      return limb.head;
    } else {
      return new BranchNotFoundError();
    }
  }

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

  async createRepository(identity: HeadIdentity): Promise<boolean> {
    const { organization, repository: name, branch, head } = identity;
    const repo: Repository = {
      organization,
      name,
      branches: { [branch]: { head } }
    };

    const { result } = await this.database
      .collection<Repository>("repository")
      .insertOne(repo);

    return result.ok === 1;
  }
}

export default Metadata;
