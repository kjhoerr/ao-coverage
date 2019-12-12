import processTemplate, { Template } from "./templates";
import path from "path";
import fs from "fs";

const genTemplate = (filename: string): Template =>
  ({
    inputFile: path.join(__dirname, "..", "example_reports", filename),
    outputFile: path.join(
      __dirname,
      "..",
      "build",
      filename.replace(/template/, "txt")
    ),
    context: { that: "this", potential: "resolved" }
  } as Template);

describe("processTemplate", () => {
  beforeAll(() =>
    fs.promises.mkdir(path.join(__dirname, "..", "build")).catch(() => null)
  );

  it("should process the template file with the given context", async () => {
    // Arrange
    const template = genTemplate("ex.template");

    // Act
    const result = await processTemplate(template);

    // Assert
    expect(result.data).not.toBeNull();
    expect(result.data).toEqual("But what is this other than resolved?");
    expect(fs.existsSync(result.outputFile)).toEqual(true);
  });

  it("should process the blank file", async () => {
    // Arrange
    const template = genTemplate("blank.template");

    // Act
    const result = await processTemplate(template);

    // Assert
    expect(result.data).not.toBeNull();
    expect(result.data).toEqual("");
    expect(fs.existsSync(result.outputFile)).toEqual(true);
  });
});
