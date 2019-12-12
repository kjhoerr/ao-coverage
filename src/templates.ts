import handlebars from "handlebars";
import fs from "fs";

export interface Template {
  inputFile: string;
  outputFile: string;
  context: object;
  data: string | undefined;
}

export default (_template: Template): Promise<Template> =>
  fs.promises
    .readFile(_template.inputFile, "utf-8")
    .then(buffer => {
      const translate = handlebars.compile(buffer);

      return {
        ..._template,
        data: translate(_template.context)
      };
    })
    .then(template =>
      fs.promises
        .writeFile(template.outputFile, template.data)
        .then(() => template)
    );
