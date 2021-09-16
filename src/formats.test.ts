import Formats, { defaultColorMatches } from "./formats";
import fs from "fs";
import path from "path";

describe("Color matcher", () => {
  it.each`
    n      | s1     | s2    | expected
    ${100} | ${75}  | ${50} | ${"4c1"}
    ${75}  | ${75}  | ${50} | ${"4c1"}
    ${50}  | ${75}  | ${50} | ${"ec1"}
    ${0}   | ${75}  | ${50} | ${"e11"}
    ${51}  | ${51}  | ${50} | ${"4c1"}
    ${50}  | ${51}  | ${50} | ${"ec1"}
    ${0}   | ${50}  | ${1}  | ${"e11"}
    ${100} | ${100} | ${0}  | ${"4c1"}
    ${0}   | ${100} | ${0}  | ${"ec1"}
    ${70}  | ${70}  | ${60} | ${"4c1"}
    ${69}  | ${70}  | ${60} | ${"5c1"}
    ${68}  | ${70}  | ${60} | ${"6c1"}
    ${67}  | ${70}  | ${60} | ${"7c1"}
    ${66}  | ${70}  | ${60} | ${"8c1"}
    ${65}  | ${70}  | ${60} | ${"9c1"}
    ${64}  | ${70}  | ${60} | ${"ac1"}
    ${63}  | ${70}  | ${60} | ${"bc1"}
    ${62}  | ${70}  | ${60} | ${"cc1"}
    ${61}  | ${70}  | ${60} | ${"dc1"}
    ${60}  | ${70}  | ${60} | ${"ec1"}
    ${11}  | ${75}  | ${11} | ${"ec1"}
    ${10}  | ${75}  | ${11} | ${"eb1"}
    ${9}   | ${75}  | ${11} | ${"ea1"}
    ${8}   | ${75}  | ${11} | ${"e91"}
    ${7}   | ${75}  | ${11} | ${"e81"}
    ${6}   | ${75}  | ${11} | ${"e71"}
    ${5}   | ${75}  | ${11} | ${"e61"}
    ${4}   | ${75}  | ${11} | ${"e51"}
    ${3}   | ${75}  | ${11} | ${"e41"}
    ${2}   | ${75}  | ${11} | ${"e31"}
    ${1}   | ${75}  | ${11} | ${"e21"}
    ${0}   | ${75}  | ${11} | ${"e11"}
    ${51}  | ${51}  | ${11} | ${"4c1"}
    ${50}  | ${51}  | ${11} | ${"4c1"}
    ${49}  | ${51}  | ${11} | ${"4c1"}
    ${48}  | ${51}  | ${11} | ${"4c1"}
    ${47}  | ${51}  | ${11} | ${"5c1"}
    ${46}  | ${51}  | ${11} | ${"5c1"}
    ${45}  | ${51}  | ${11} | ${"5c1"}
    ${44}  | ${51}  | ${11} | ${"5c1"}
    ${43}  | ${51}  | ${11} | ${"6c1"}
    ${39}  | ${51}  | ${11} | ${"7c1"}
    ${35}  | ${51}  | ${11} | ${"8c1"}
    ${31}  | ${51}  | ${11} | ${"9c1"}
    ${27}  | ${51}  | ${11} | ${"ac1"}
    ${23}  | ${51}  | ${11} | ${"bc1"}
    ${19}  | ${51}  | ${11} | ${"cc1"}
    ${15}  | ${51}  | ${11} | ${"dc1"}
    ${11}  | ${51}  | ${11} | ${"ec1"}
  `("should return $expected at $n%", ({ n, s1, s2, expected }) => {
    // Arrange
    const gradient = { stage1: s1, stage2: s2 };

    // Act
    const result = defaultColorMatches(n, gradient);

    // Assert
    expect(result).toEqual(expected);
  });
});

describe("Formats object", () => {
  it("should list the available formats", () => {
    // Arrange

    // Act
    const result = Formats.listFormats();

    // Assert
    expect(result).toEqual(["tarpaulin", "cobertura"]);
  });

  it("should return the requested format", () => {
    // Arrange

    // Act
    const result = Formats.getFormat("tarpaulin");

    // Assert
    expect(result).toBeDefined();
    expect(result.matchColor).toBeInstanceOf(Function);
    expect(result.parseCoverage).toBeInstanceOf(Function);
  });
});

describe("Tarpaulin format", () => {
  const reportPath = (file: string): string =>
    path.join(__dirname, "..", "example_reports", file);

  it("should use the default color matcher", () => {
    // Arrange
    const format = Formats.getFormat("tarpaulin");

    // Act
    const matcher = format.matchColor;

    // Assert
    expect(matcher).toEqual(defaultColorMatches);
  });

  it("should parse coverage from a normal tarpaulin file", async () => {
    // Arrange
    const file = fs.readFileSync(reportPath("tarpaulin-report.html"), "utf-8");

    const format = Formats.getFormat("tarpaulin");

    // Act
    const result = await format.parseCoverage(file);

    // Assert
    expect(typeof result).toEqual("number");
    if (typeof result === "number") {
      // 96.17% is the result given in the document itself
      expect(result.toFixed(2)).toEqual("96.17");
    }
  });

  it("should parse coverage from an empty tarpaulin file", async () => {
    // Arrange
    const file = fs.readFileSync(reportPath("tarpaulin-empty.html"), "utf-8");

    const format = Formats.getFormat("tarpaulin");

    // Act
    const result = await format.parseCoverage(file);

    // Assert
    expect(typeof result).toEqual("number");
    if (typeof result === "number") {
      expect(result.toFixed(2)).toEqual("0.00");
    }
  });

  it("should return error when parsing coverage from invalid file", async () => {
    // Arrange
    const file = fs.readFileSync(reportPath("tarpaulin-invalid.html"), "utf-8");

    const format = Formats.getFormat("tarpaulin");

    // Act
    const result = await format.parseCoverage(file);

    // Assert
    expect(typeof result).not.toEqual("number");
    if (typeof result !== "number") {
      expect(result.message).toEqual("Invalid report document");
    }
  });
});

describe("Cobertura format", () => {
  const reportPath = (file: string): string =>
    path.join(__dirname, "..", "example_reports", file);

  it("should use the default color matcher", () => {
    // Arrange
    const format = Formats.getFormat("cobertura");

    // Act
    const matcher = format.matchColor;

    // Assert
    expect(matcher).toEqual(defaultColorMatches);
  });

  it("should parse coverage from a normal cobertura file", async () => {
    // Arrange
    const file = fs.readFileSync(reportPath("cobertura-report.xml"), "utf-8");

    const format = Formats.getFormat("cobertura");

    // Act
    const result = await format.parseCoverage(file);

    // Assert
    expect(typeof result).toEqual("number");
    if (typeof result === "number") {
      // 96.17% is the result given in the document itself
      expect(result.toFixed(2)).toEqual("96.04");
    }
  });

  it("should parse coverage from an empty cobertura file", async () => {
    // Arrange
    const file = fs.readFileSync(reportPath("cobertura-empty.xml"), "utf-8");

    const format = Formats.getFormat("cobertura");

    // Act
    const result = await format.parseCoverage(file);

    // Assert
    expect(typeof result).toEqual("number");
    if (typeof result === "number") {
      expect(result.toFixed(2)).toEqual("0.00");
    }
  });

  it("should return error when parsing coverage from invalid file", async () => {
    // Arrange
    const file = fs.readFileSync(reportPath("cobertura-invalid.xml"), "utf-8");

    const format = Formats.getFormat("cobertura");

    // Act
    const result = await format.parseCoverage(file);

    // Assert
    expect(typeof result).not.toEqual("number");
    if (typeof result !== "number") {
      expect(result.message).toEqual("Invalid report document");
    }
  });
});
