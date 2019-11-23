interface Format {
    // returns the coverage value as %: Number(90.0), Number(100.0), Number(89.5)
    parse_coverage: (file: Document) => number,
    match_color: (coverage: number, stage_1: number, stage_2: number) => string,
}

interface FormatList {
    [key: string]: Format
}

interface FormatObj {
    formats: FormatList,
    list_formats: () => string[],
    get_format: (format: string) => Format,
}

// color is a gradient from green (>=stage_1) -> yellow (stage_2) -> red. Stage values should come from metadata.
const default_color_matches = (coverage: number, stage_1: number, stage_2: number) => {
    const gradient = coverage >= stage_1 ? 15 :
        (coverage >= stage_2 ?
            (Math.floor(coverage) - stage_2) * 16 + 15 :
            240 + Math.floor(coverage / (stage_2 / 15))); 
    return gradient.toString(16) + "0";
};

const FormatsObj: FormatObj = {
    formats: {
        tarpaulin: {
            parse_coverage: (file: Document) => {
                //TODO parse coverage from file (example?)
                return 0.0;
            },
            match_color: default_color_matches,
        },
    },

    list_formats: function () {
        return Object.keys(this.formats);
    },

    get_format: function (format: string) {
        return this.formats[format];
    }
}

export default FormatsObj;