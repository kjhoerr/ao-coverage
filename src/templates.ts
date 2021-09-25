import handlebars from "handlebars";
import fs from "fs";

export interface Template {
  inputFile: string;
  outputFile: string;
  context: Record<string, string>;
  data?: string;
}

export default async (_template: Template): Promise<Template> => {
  const buffer = await fs.promises.readFile(_template.inputFile, "utf-8");

  const translate = handlebars.compile(buffer);
  const template = {
    ..._template,
    data: translate(_template.context),
  };

  await fs.promises.writeFile(template.outputFile, template.data);

  return template;
};
