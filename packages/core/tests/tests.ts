import dotenv from "dotenv";
dotenv.config();
import { generateMermaidFromFile, generateMermaidFromPath } from "../src";

async function main() {
  // Single file
  const mermaidText = await generateMermaidFromFile(
    "./tests/fixtures/raw-file.ts",
  );
  console.log({ mermaidText });

  // Directory
  const mermaidTexts = await generateMermaidFromPath(
    "./tests/fixtures/directory",
  );
  console.log({ mermaidTexts });
}

main();
