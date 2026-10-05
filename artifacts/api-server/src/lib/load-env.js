// Loads the ROOT .env file (walking up from the current directory) before any
// other module reads process.env.DATABASE_URL. Must be the FIRST import of index.js.
import fs from "node:fs";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      process.loadEnvFile(candidate);
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
