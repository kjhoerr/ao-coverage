import { Db } from "mongodb";
import winston from "winston";

import loggerConfig from "./util/logger";
import { BranchNotFoundError } from "./errors";
import { GradientStyle } from "./formats";

interface HeadContext {
  commit: string;
  format: string;
}

export const isError = (
  obj: HeadContext | BranchNotFoundError
): obj is BranchNotFoundError => {
  return Object.keys(obj).includes("name");
};

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

const logger = winston.createLogger(loggerConfig("META"));

export interface EnvConfig {
  token: string;
  uploadLimit: number;
  hostDir: string;
  publicDir: string;
  stage1: number;
  stage2: number;
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

  getGradientStyle(): GradientStyle {
    return {
      stage1: this.config.stage1,
      stage2: this.config.stage2
    };
  }

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
        ["branches." + branch]: { $exists: true, $ne: null }
      });

    if (result !== null && Object.keys(result.branches).includes(branch)) {
      const limb = result.branches[branch];
      const head = typeof limb.head === "string" ? limb.head : limb.head.commit;
      const format =
        typeof limb.head === "string" ? "tarpaulin" : limb.head.format;
      logger.debug(
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

    const result = await this.database
      .collection<Repository>("repository")
      .insertOne(repo);

    return result.acknowledged;
  }
}

export default Metadata;
