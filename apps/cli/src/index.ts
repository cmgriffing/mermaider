#!/bin/node
import "dotenv/config";
import fs from "fs";
import path from "path";
import { program } from "commander";
import { run as mermaidRun } from "@mermaid-js/mermaid-cli";

import { generateMermaidFromPath } from "@mermaider/core";

program
  .name("mermaider")
  .description("CLI to generate mermaid diagrams from code")
  .version("0.0.1");

program
  .command("parse")
  .description(
    "Parse the files at specified paths into mmd files and svg files",
  )
  .argument("<paths...>", "paths to parse")
  .action(async (paths, options) => {
    try {
      const diagrams = await generateMermaidFromPath(paths);

      await Promise.all(
        diagrams.map(async (diagram) => {
          const pathParts = path.parse(diagram.filePath);

          const outputPath = path.join(pathParts.dir, `${pathParts.name}.mmd`);
          await fs.promises.writeFile(outputPath, diagram.diagram);
          await mermaidRun(outputPath, `${outputPath.replace(".mmd", "")}.svg`);

          //   mermaidRun([diagram.filePath], {
          //     output: diagram.filePath.replace(".ts", ".mmd"),
          //   });
        }),
      );
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  });

program.parse();
