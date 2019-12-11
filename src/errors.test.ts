import { InvalidReportDocumentError, BranchNotFoundError } from "./errors";

describe("InvalidReportDocumentError", () => {
  it("should have the correct name and default message", () => {
    // Arrange

    // Act
    const err = new InvalidReportDocumentError();

    // Assert
    expect(err.name).toEqual("InvalidReportDocumentError");
    expect(err.message).toEqual("Invalid report document");
  });
});

describe("BranchNotFoundError", () => {
  it("should have the correct name and default message", () => {
    // Arrange

    // Act
    const err = new BranchNotFoundError();

    // Assert
    expect(err.name).toEqual("BranchNotFoundError");
    expect(err.message).toEqual("Branch not found");
  });
});
