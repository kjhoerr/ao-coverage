interface Format {
    parse_coverage: (file: Document) => number;
}

interface FormatList {
    [key: string]: Format
}

interface FormatObj {
    formats: FormatList,
    list_formats: () => string[],
    get_format: (format: string) => Format,
}

const FormatsObj: FormatObj = {
    formats: {
        tarpaulin: {
            parse_coverage: (file: Document) => {
                return 0.0;
            }
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