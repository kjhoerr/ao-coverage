export class BranchNotFoundError extends Error {
  constructor() {
    super();
    this.message = "Branch not found";
  }
}

export class InvalidReportDocumentError extends Error {
  constructor() {
    super();
    this.message = "Invalid report document";
  }
}
