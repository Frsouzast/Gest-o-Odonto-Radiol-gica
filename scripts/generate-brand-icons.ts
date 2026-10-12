import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const publicDir = join(import.meta.dir, "..", "public");
const source = await readFile(join(publicDir, "icon.svg"));

for (const [size, file] of [
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [180, "apple-touch-icon.png"],
] as const) {
  await sharp(source).resize(size, size).png().toFile(join(publicDir, file));
  console.log(`Gerado ${file}`);
}
