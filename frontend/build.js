const esbuild = require("esbuild");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "dist");
fs.mkdirSync(distDir, { recursive: true });

esbuild.buildSync({
  entryPoints: [path.join(__dirname, "src", "main.jsx")],
  bundle: true,
  outfile: path.join(distDir, "bundle.js"),
  jsx: "automatic",
  loader: { ".js": "jsx" },
  minify: true,
  target: "chrome120", // Electron embute um Chromium recente, não precisa de transpilação pra navegadores antigos
});
console.log("✓ bundle.js gerado");

execSync(
  `npx @tailwindcss/cli -i "${path.join(__dirname, "src", "styles.css")}" -o "${path.join(distDir, "styles.css")}" --minify`,
  { stdio: "inherit", cwd: path.join(__dirname, "..") }
);
console.log("✓ styles.css gerado");

fs.copyFileSync(path.join(__dirname, "index.html"), path.join(distDir, "index.html"));
console.log("✓ index.html copiado");
