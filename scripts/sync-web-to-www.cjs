const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(projectRoot, "www");

const filesToCopy = [
  "index.html",
  "style.css",
  "script.js",
  "lobby.js",
  "multiplayer.js",
  "match-stats.json",
  "creep-balance-sheet.csv",
  "tower-balance-sheet.csv",
];

const directoriesToCopy = [
  "assets",
  "bri assets",
];

function ensureParentDirectory(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function copyFile(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const destinationPath = path.join(outputRoot, relativePath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${relativePath}`);
  }

  ensureParentDirectory(destinationPath);
  fs.copyFileSync(sourcePath, destinationPath);
  console.log(`Copied file: ${relativePath}`);
}

function copyDirectory(relativePath) {
  const sourcePath = path.join(projectRoot, relativePath);
  const destinationPath = path.join(outputRoot, relativePath);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source directory: ${relativePath}`);
  }

  fs.mkdirSync(outputRoot, { recursive: true });
  fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
  console.log(`Copied directory: ${relativePath}`);
}

function main() {
  fs.mkdirSync(outputRoot, { recursive: true });

  filesToCopy.forEach(copyFile);
  directoriesToCopy.forEach(copyDirectory);

  console.log(`Web bundle synced to ${outputRoot}`);
}

main();
