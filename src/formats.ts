import { JSDOM } from "jsdom";
import { Parser } from "xml2js";
import { InvalidReportDocumentError } from "./errors";

type CoverageResult = number | InvalidReportDocumentError;

export interface Format {
  // returns the coverage value as %: Number(90.0), Number(100.0), Number(89.5)
  parseCoverage: (contents: string) => Promise<CoverageResult>;
  matchColor: (coverage: number, style: GradientStyle) => string;
  fileName: string;
}

interface FormatList {
  [key: string]: Format;
}

interface FormatObj {
  formats: FormatList;
  listFormats: () => string[];
  getFormat: (format: string) => Format;
}

export interface GradientStyle {
  stage1: number;
  stage2: number;
}

// color is a gradient from green (>=stage_1) -> yellow (stage_2) -> red. Stage values should come from metadata.
export const defaultColorMatches = (
  coverage: number,
  style: GradientStyle
): string => {
  const gradient =
    coverage >= style.stage1
      ? 76
      : coverage >= style.stage2
      ? Math.floor(
          ((style.stage1 - coverage) / (style.stage1 - style.stage2)) * 10
        ) *
          16 +
        76
      : 225 + Math.floor(coverage / (style.stage2 / 11));
  return gradient.toString(16) + "1";
};

const FormatsObj: FormatObj = {
  formats: {
    tarpaulin: {
      parseCoverage: async (contents: string): Promise<CoverageResult> => {
        const file = new JSDOM(contents).window.document;
        const scripts = file.getElementsByTagName("script");
        if (scripts.length === 0) {
          return new InvalidReportDocumentError();
        }
        const data = scripts[0].text;
        const accumFunc = (regex: RegExp): number => {
          let acc = 0;
          while (true) {
            const match = regex.exec(data);
            if (match === null) break;
            acc += Number(match[1]);
          }

          return acc;
        };

        const covered = accumFunc(/"covered":(\d*)/g);
        const coverable = accumFunc(/"coverable":(\d*)/g);

        // do not error if LOC is 0
        if (coverable === 0) {
          return 0.0;
        }
        return (100 * covered) / coverable;
      },
      matchColor: defaultColorMatches,
      fileName: "index.html"
    },
    cobertura: {
      parseCoverage: async (contents: string): Promise<CoverageResult> => {
        try {
          const document = await new Parser().parseStringPromise(contents);

          if (document.coverage === undefined) {
            return new InvalidReportDocumentError();
          } else {
            const validLines = Number(document.coverage.$["lines-valid"]);
            const coveredLines = Number(document.coverage.$["lines-covered"]);
            // do not error if LOC is 0
            if (validLines === 0) {
              return 0.0;
            }
            return (100 * coveredLines) / validLines;
          }
        } catch (err) {
          return new InvalidReportDocumentError();
        }
      },
      matchColor: defaultColorMatches,
      fileName: "index.xml"
    }
  },

  listFormats: function() {
    return Object.keys(this.formats);
  },

  getFormat: function(format: string) {
    return this.formats[format];
  }
};

export default FormatsObj;
