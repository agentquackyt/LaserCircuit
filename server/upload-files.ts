import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parseArgs } from "util";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// 1. Parse CLI arguments
const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    weekly: { type: "boolean", default: false },
    monthly: { type: "boolean", default: false },
    title: { type: "string" },
    slug: { type: "string" },
  },
  allowPositionals: true,
});

const targetFile = positionals[0];

if (!targetFile) {
  console.log(`
Usage:
  bun run scripts/upload-level.ts <file-or-id> [options]

Examples:
  bun run scripts/upload-level.ts level3.json
  bun run scripts/upload-level.ts level3 --weekly
  bun run scripts/upload-level.ts ./level/level3.json --weekly --title "Grand Laser Challenge"
  bun run scripts/upload-level.ts level3.json --monthly

Options:
  --weekly     Mark as weekly challenge (active for 7 days)
  --monthly    Mark as monthly challenge (active for 30 days)
  --title      Override the title found in JSON
  --slug       Override the auto-generated slug
`);
  process.exit(1);
}

// 2. Resolve file path (supports "level3", "level3.json", or "./level/level3.json")
let filePath = resolve(process.cwd(), targetFile);
if (!existsSync(filePath)) {
  const fallback = resolve(process.cwd(), "level", targetFile.endsWith(".json") ? targetFile : `${targetFile}.json`);
  if (existsSync(fallback)) {
    filePath = fallback;
  } else {
    console.error(`❌ Could not locate level file at "${targetFile}" or "${fallback}".`);
    process.exit(1);
  }
}

// 3. Read and clean file contents
let rawData: Record<string, any>;
try {
  rawData = JSON.parse(readFileSync(filePath, "utf-8"));
} catch (err: any) {
  console.error(`❌ Failed to parse JSON from ${filePath}:`, err.message);
  process.exit(1);
}

// Extract level identifier and title directly from the JSON payload[cite: 2]
const fileId: string = rawData.id || targetFile.split("/").pop()?.replace(".json", "") || "level";
const finalTitle: string = values.title || rawData.title || `Level ${fileId}`;

// Strip out numeric list keys (e.g. "0", "1", "2") preserved from editor list exports[cite: 2]
const cleanedLevelData: Record<string, any> = {};
for (const [key, value] of Object.entries(rawData)) {
  if (!/^\d+$/.test(key)) {
    cleanedLevelData[key] = value;
  }
}

// 4. Determine period and active schedule
type LevelPeriod = "standard" | "weekly" | "monthly";
let period: LevelPeriod = "standard";

if (values.weekly) period = "weekly";
else if (values.monthly) period = "monthly";

const now = new Date();
const activeFrom = now.toISOString();
let activeUntil: string | null = null;
let slug = values.slug;

if (period === "weekly") {
  const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  activeUntil = endDate.toISOString();
  if (!slug) slug = `weekly-${now.toISOString().slice(0, 10)}`;
} else if (period === "monthly") {
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  activeUntil = endDate.toISOString();
  if (!slug) slug = `monthly-${now.toISOString().slice(0, 7)}`;
} else {
  // Standard levels are permanent
  if (!slug) slug = fileId;
}

// 5. Upsert into Supabase
console.log(`🚀 Uploading "${finalTitle}" as [${period.toUpperCase()}]...`);

const { error } = await supabase.from("levels").upsert(
  {
    slug,
    title: finalTitle,
    period,
    active_from: activeFrom,
    active_until: activeUntil,
    level_data: cleanedLevelData,
  },
  { onConflict: "slug" }
);

if (error) {
  console.error(`❌ Upload failed:`, error.message);
  process.exit(1);
}

console.log(`✅ Success!`);
console.log(`   Slug:         ${slug}`);
console.log(`   Title:        ${finalTitle}`);
console.log(`   Period:       ${period}`);
console.log(`   Active From:  ${activeFrom}`);
console.log(`   Active Until: ${activeUntil ?? "Permanent (no expiry)"}`);