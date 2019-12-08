import { Db } from "mongodb";
import winston from "winston";

import logger_config from "./util/logger";

/** //FIXME fix document schema
 * Rather than using branches as the core, this should be adopted into the following document model:
 * repo:
 *  - org
 *  - name
 *  - token
 *  - branches: {
 *      [branchname]: {
 *        head
 *      }
 *    }
 */
export interface Branch {
  org: string;
  repo: string;
  name: string;
  head: string;
}
const logger = winston.createLogger(logger_config("META"));

class Metadata {
  database: Db;

  constructor(client: Db) {
    this.database = client;
  }

  async getHeadCommit(
    org: string,
    repo: string,
    branch: string
  ): Promise<string> {
    const result = await this.database
      .collection<Branch>("branch")
      .findOne({ org, repo, name: branch });

    if (result !== null) {
      logger.debug(
        "Found commit %s for ORB %s/%s/%s",
        result.head,
        org,
        repo,
        branch
      );
      return result.head;
    } else {
      throw Error("Branch not found");
    }
  }

  async updateBranch(branch: Branch): Promise<boolean> {
    const { head, ...matcher } = branch;
    const { result } = await this.database
      .collection<Branch>("branch")
      .replaceOne(matcher, branch, { upsert: true });
    return result.ok === 1;
  }
}

export default Metadata;
