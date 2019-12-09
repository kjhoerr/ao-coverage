import { InvalidReportDocumentError } from "./errors";

export interface Format {
  // returns the coverage value as %: Number(90.0), Number(100.0), Number(89.5)
  parse_coverage: (file: Document) => number | InvalidReportDocumentError;
  match_color: (coverage: number, style: GradientStyle) => string;
}

interface FormatList {
  [key: string]: Format;
}

interface FormatObj {
  formats: FormatList;
  list_formats: () => string[];
  get_format: (format: string) => Format;
}

export interface GradientStyle {
  stage_1: number;
  stage_2: number;
}

// color is a gradient from green (>=stage_1) -> yellow (stage_2) -> red. Stage values should come from metadata.
const default_color_matches = (coverage: number, style: GradientStyle) => {
  const gradient =
    coverage >= style.stage_1
      ? 15
      : coverage >= style.stage_2
      ? (Math.floor(coverage) - style.stage_2) * 16 + 15
      : 240 + Math.floor(coverage / (style.stage_2 / 15));
  return gradient.toString(16) + "0";
};

const FormatsObj: FormatObj = {
  formats: {
    tarpaulin: {
      parse_coverage: (file: Document) => {
        const scripts = file.getElementsByTagName("script");
        if (scripts.length == 0) {
          return new InvalidReportDocumentError();
        }
        const data = scripts[0].text;
        const accumFunc = (regex: RegExp) => {
          let acc: number = 0;
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
      match_color: default_color_matches
    }
  },

  list_formats: function() {
    return Object.keys(this.formats);
  },

  get_format: function(format: string) {
    return this.formats[format];
  }
};

export default FormatsObj;
