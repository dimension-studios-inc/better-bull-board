// Writes a release version into a package.json without committing it (semantic-release's prepare step).
// Usage: bun scripts/set-package-version.ts <package.json> <version>
import { readFile, writeFile } from "node:fs/promises"

const [path, version] = process.argv.slice(2)
if (!path || !version) throw new Error("Usage: set-package-version.ts <package.json> <version>")

const pkg = JSON.parse(await readFile(path, "utf8")) as { name: string; version?: string }
pkg.version = version
await writeFile(path, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`${pkg.name}@${version}`)
