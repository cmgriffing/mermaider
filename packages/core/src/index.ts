import { glob } from "glob";
import * as fs from "fs";
import path from "path";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export interface MermaiderResult {
  filePath: string;
  diagram: string;
}

export async function generateMermaidFromPath(
  globPath: string | string[],
): Promise<MermaiderResult[]> {
  const paths = await glob(globPath);

  const filesToAnalyze: string[] = [];

  await Promise.all(
    paths.map(async (filePath) => {
      const stats = await fs.promises.lstat(filePath);

      if (stats.isFile()) {
        filesToAnalyze.push(filePath);
      } else if (stats.isDirectory()) {
        // check for .mermaider file within same directory
        const parsedPath = path.parse(filePath);

        const mermaiderFilePath = path.join(parsedPath.dir, `.mermaider`);

        let fileExists = false;
        try {
          await fs.promises.access(mermaiderFilePath, fs.constants.F_OK);
          fileExists = true;
        } catch (err) {
          // file does not exist
          fileExists = false;
        }

        if (fileExists) {
          const parsedMermaiderFilePath = path.parse(mermaiderFilePath);

          const mermaiderFileContents = await fs.promises.readFile(
            mermaiderFilePath,
            "utf8",
          );
          const mermaiderFileEntries = mermaiderFileContents.split("\n");

          const globbedMermaiderFileEntries = await Promise.all(
            mermaiderFileEntries.map((entry) =>
              glob(path.resolve(parsedMermaiderFilePath.dir, entry)),
            ),
          );

          const flattenedGlobbedMermaiderFileEntries = await Promise.all(
            globbedMermaiderFileEntries.flat().map(async (entry) => {
              const stats = await fs.promises.lstat(entry);
              if (stats.isFile()) {
                return entry;
              }
            }),
          );

          const filteredFlattenedGlobbedMermaiderFileEntries =
            flattenedGlobbedMermaiderFileEntries.filter(
              (entry) => entry !== undefined,
            );

          filesToAnalyze.push(...filteredFlattenedGlobbedMermaiderFileEntries);
        }
      }
    }),
  );

  return Promise.all(
    filesToAnalyze.map(async (file) => {
      return generateMermaidFromFile(file);
    }),
  );
}

export async function generateMermaidFromFile(
  file: string,
): Promise<MermaiderResult> {
  const fileContents = await fs.promises.readFile(file, "utf8");
  return {
    filePath: file,
    diagram: await generateMermaidFromText(fileContents),
  };
}

export async function generateMermaidFromText(text: string): Promise<string> {
  const result = await generateText({
    model: anthropic("claude-3-5-sonnet-latest"),
    maxTokens: 1024,
    system:
      "You understand that the user is going to pass you a js file that represents an API endpoint's logic and I want you to give me a mermaid state diagram from it. Do not include any other text in the response besides the mermaid diagram code. Do not include the wrapping markdown code blocks.",
    messages: [
      {
        role: "user",
        content: text,
      },
    ],
  });

  return result.text;
}
