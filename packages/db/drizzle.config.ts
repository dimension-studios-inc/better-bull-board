/* eslint-disable no-process-env */
import { config as dotenvConfig } from "dotenv"
import { defineConfig } from "drizzle-kit"

dotenvConfig()

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
  tablesFilter: ["!spatial_ref_sys", "!public.geometry_columns", "!public.geography_columns", "!_prisma_migrations"],
})
