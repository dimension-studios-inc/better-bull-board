import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v7 as uuidv7 } from "uuid";
import { clickhouseClient } from "~/lib/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

async function main() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let migrations: string[] | null = null;

  for (const file of files) {
    if (!file.startsWith("000_")) {
      const loadMigrations = async () => {
        if (migrations) return;
        const migrationsQuery = await clickhouseClient.query({
          query: "SELECT name FROM migrations_ch",
        });
        const migrationsJson = (await migrationsQuery.json()).data as {
          name: string;
        }[];
        migrations = migrationsJson.map((m) => m.name);
      };
      await loadMigrations();
      if ((migrations as string[] | null)?.includes(file)) {
        console.log(`✅ Skipping migration: ${file}`);
        continue;
      }
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`➡️  Running migration: ${file}`);
    try {
      await clickhouseClient.command({
        query: sql,
        clickhouse_settings: { wait_end_of_query: 1 },
      });
      await clickhouseClient.insert({
        table: "migrations_ch",
        values: [
          {
            id: uuidv7(),
            name: file,
            applied_at: Date.now(), // JS Date is auto-converted
          },
        ],
        format: "JSONEachRow",
      });
      console.log(`✅ Done: ${file}`);
    } catch (err) {
      console.error(`❌ Failed: ${file}`, err);
      process.exit(1);
    }
  }

  await clickhouseClient.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
