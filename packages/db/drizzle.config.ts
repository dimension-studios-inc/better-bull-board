import { config as dotenvConfig } from "dotenv"
import { defineConfig } from "drizzle-kit"

// quiet: dotenv logs to stderr, which the ingest migration reports as a migration error
dotenvConfig({ quiet: true })

const dbUrl = process.env.DATABASE_URL_NON_POOLING ?? process.env.DATABASE_URL

if (!dbUrl) {
  throw new Error("DATABASE_URL_NON_POOLING or DATABASE_URL must be set")
}

export default defineConfig({
  schema: "./src/schemas/**/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
  extensionsFilters: ["postgis"],
  tablesFilter: [
    "!spatial_ref_sys",
    "!public.geometry_columns",
    "!public.geography_columns",
    "!_prisma_migrations",
  ],
})
