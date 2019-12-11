import Formats, { defaultColorMatches } from "./formats";
import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";

describe("Color matcher", () => {
  it.each`
    n      | s1     | s2    | expected
    ${100} | ${75}  | ${50} | ${"0f0"}
    ${75}  | ${75}  | ${50} | ${"0f0"}
    ${50}  | ${75}  | ${50} | ${"ff0"}
    ${0}   | ${75}  | ${50} | ${"f00"}
    ${51}  | ${51}  | ${50} | ${"0f0"}
    ${50}  | ${51}  | ${50} | ${"ff0"}
    ${0}   | ${50}  | ${1}  | ${"f00"}
    ${100} | ${100} | ${0}  | ${"0f0"}
    ${0}   | ${100} | ${0}  | ${"ff0"}
    ${75}  | ${75}  | ${60} | ${"0f0"}
    ${74}  | ${75}  | ${60} | ${"1f0"}
    ${73}  | ${75}  | ${60} | ${"2f0"}
    ${72}  | ${75}  | ${60} | ${"3f0"}
    ${71}  | ${75}  | ${60} | ${"4f0"}
    ${70}  | ${75}  | ${60} | ${"5f0"}
    ${69}  | ${75}  | ${60} | ${"6f0"}
    ${68}  | ${75}  | ${60} | ${"7f0"}
    ${67}  | ${75}  | ${60} | ${"8f0"}
    ${66}  | ${75}  | ${60} | ${"9f0"}
    ${65}  | ${75}  | ${60} | ${"af0"}
    ${64}  | ${75}  | ${60} | ${"bf0"}
    ${63}  | ${75}  | ${60} | ${"cf0"}
    ${62}  | ${75}  | ${60} | ${"df0"}
    ${61}  | ${75}  | ${60} | ${"ef0"}
    ${60}  | ${75}  | ${60} | ${"ff0"}
    ${15}  | ${75}  | ${15} | ${"ff0"}
    ${14}  | ${75}  | ${15} | ${"fe0"}
    ${13}  | ${75}  | ${15} | ${"fd0"}
    ${12}  | ${75}  | ${15} | ${"fc0"}
    ${11}  | ${75}  | ${15} | ${"fb0"}
    ${10}  | ${75}  | ${15} | ${"fa0"}
    ${9}   | ${75}  | ${15} | ${"f90"}
    ${8}   | ${75}  | ${15} | ${"f80"}
    ${7}   | ${75}  | ${15} | ${"f70"}
    ${6}   | ${75}  | ${15} | ${"f60"}
    ${5}   | ${75}  | ${15} | ${"f50"}
    ${4}   | ${75}  | ${15} | ${"f40"}
    ${3}   | ${75}  | ${15} | ${"f30"}
    ${2}   | ${75}  | ${15} | ${"f20"}
    ${1}   | ${75}  | ${15} | ${"f10"}
    ${0}   | ${75}  | ${15} | ${"f00"}
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
    expect(result).toEqual(["tarpaulin"]);
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

  it("should parse coverage from a normal tarpaulin file", () => {
    // Arrange
    const file = fs.readFileSync(reportPath("tarpaulin-report.html"), "utf-8");
    const document = new JSDOM(file).window.document;

    const format = Formats.getFormat("tarpaulin");

    // Act
    const result = format.parseCoverage(document);

    // Assert
    expect(typeof result).toEqual("number");
    if (typeof result === "number") {
      // 96.17% is the result given in the document itself
      expect(result.toFixed(2)).toEqual("96.17");
    }
  });

  it("should parse coverage from an empty tarpaulin file", () => {
    // Arrange
    const file = fs.readFileSync(reportPath("tarpaulin-empty.html"), "utf-8");
    const document = new JSDOM(file).window.document;

    const format = Formats.getFormat("tarpaulin");

    // Act
    const result = format.parseCoverage(document);

    // Assert
    expect(typeof result).toEqual("number");
    if (typeof result === "number") {
      expect(result.toFixed(2)).toEqual("0.00");
    }
  });

  it("should return error when parsing coverage from invalid file", () => {
    // Arrange
    const file = fs.readFileSync(reportPath("tarpaulin-invalid.html"), "utf-8");
    const document = new JSDOM(file).window.document;

    const format = Formats.getFormat("tarpaulin");

    // Act
    const result = format.parseCoverage(document);

    // Assert
    expect(typeof result).not.toEqual("number");
    if (typeof result !== "number") {
      expect(result.message).toEqual("Invalid report document");
    }
  });
});
