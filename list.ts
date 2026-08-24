import { join } from "path";
import { readdir, stat } from "fs/promises";

interface LevelEntry {
  id: string;
  title: string;
}

const LEVEL_DIR = "./level";
const OUTPUT_FILE = join(LEVEL_DIR, "list.json");

async function generateList() {
  const dirExists = await stat(LEVEL_DIR).catch(() => null);
  if (!dirExists?.isDirectory()) {
    console.error(`Error: Directory "${LEVEL_DIR}" does not exist.`);
    process.exit(1);
  }

  const files = await readdir(LEVEL_DIR);

  // Match only "level<number>.json" files (e.g. level1.json, level2.json)
  const levelFiles = files
    .map((name) => {
      const match = name.match(/^level(\d+)\.json$/i);
      return match ? { name, num: parseInt(match[1]!, 10) } : null;
    })
    .filter((entry): entry is { name: string; num: number } => entry !== null)
    .sort((a, b) => a.num - b.num);

  const levelList: LevelEntry[] = await Promise.all(
    levelFiles.map(async ({ name }) => {
      const filePath = join(LEVEL_DIR, name);
      const file = Bun.file(filePath);
      const data = await file.json();

      return {
        id: data.id ?? `level${name.replace(/[^0-9]/g, "")}`,
        title: data.title ?? "Untitled Level",
      };
    })
  );

  await Bun.write(OUTPUT_FILE, JSON.stringify(levelList, null, 2) + "\n");
  console.log(`Generated ${OUTPUT_FILE} with ${levelList.length} levels.`);
}

await generateList();