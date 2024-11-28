import dotenv from "dotenv";
dotenv.config();
import {
  generateMermaidFromFile,
  generateMermaidFromPath,
  renderMermaid,
} from "../src";

async function main() {
  // Single file
  const mermaidText = await generateMermaidFromFile(
    "./tests/fixtures/raw-file.ts",
  );
  console.log({ mermaidText });

  const mermaidSvg = await renderMermaid(
    "./tests/fixtures/raw-file.ts",
    mermaidText,
  );
  console.log({ mermaidSvg });

  // Directory
  //   const mermaidTexts = await generateMermaidFromPath("./tests/fixtures/directory");
  //   console.log({ mermaidTexts });
}

main();
