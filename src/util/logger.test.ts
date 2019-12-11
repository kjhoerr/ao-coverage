import configureLogger from "./logger";

describe("Logger configurer", () => {
  it("should set passed clazz as label", () => {
    // Arrange
    const clazz = "important-clazz-name";

    // Act
    const result = configureLogger(clazz);

    // Assert
    const adapter = {
      level: "info",
      message: "test/10"
    };
    const actual = result.format.transform(Object.assign({}, adapter));
    expect(typeof actual).not.toEqual("boolean");
    if (typeof actual !== "boolean") {
      expect(actual.level).toEqual(adapter.level);
      expect(actual.message).toEqual(adapter.message);
      expect(actual.label).toEqual(clazz);
    }
  });
});
