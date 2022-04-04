import configureLogger from "./logger";
import { SPLAT } from "triple-beam";
import Transport from "winston-transport";

describe("Logger configurer", () => {
  it("should set passed clazz as label", () => {
    // Arrange
    const clazz = "important-clazz-name";
    const adapter = {
      level: "info",
      message: "test/10",
    };

    // Act
    const result = configureLogger(clazz, adapter.level);
    const actual = result.format.transform(Object.assign({}, adapter));

    // Assert
    expect(typeof actual).not.toEqual("boolean");
    if (typeof actual !== "boolean") {
      expect(actual.level).toEqual(adapter.level);
      expect(actual.message).toEqual(adapter.message);
      expect(actual.label).toEqual(clazz);
    }
  });

  it("should set default formats", () => {
    // Arrange
    const label = "aaa";
    const adapter = {
      level: "info",
      message: "%s/10",
      [SPLAT]: ["test"],
    };

    // Act
    const result = configureLogger(label, adapter.level);
    const actual = result.format.transform(Object.assign({}, adapter));

    // Assert
    expect(typeof actual).not.toEqual("boolean");
    if (typeof actual !== "boolean") {
      expect(actual.message).toEqual("test/10");
      expect(typeof actual.timestamp).toEqual("string");
      expect(typeof actual.label).toEqual("string");
    }
  });

  it("should set expected transport methods", () => {
    // Arrange
    const label = "aaa";

    // Act
    const result = configureLogger(label, "info");

    // Assert
    expect(result.transports).toBeInstanceOf(Array);
    expect(result.transports.length).toEqual(1);
    result.transports.forEach((t) => expect(t).toBeInstanceOf(Transport));
  });
});
