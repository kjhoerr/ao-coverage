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

export const Messages = {
  FileNotFound: "File not found",
  FileTooLarge: "Uploaded file is too large",
  InvalidFormat: "Invalid reporting format",
  InvalidToken: "Invalid token",
  UnknownError: "Unknown error occurred"
};
