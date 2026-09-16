// รันเทสต์ทุกไฟล์: node tests/run.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAll } from "./_harness.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".test.mjs")).sort();
for (const f of files) {
  console.log(`\n── ${f}`);
  await import(pathToFileURL(path.join(dir, f)).href);
}
await runAll();
