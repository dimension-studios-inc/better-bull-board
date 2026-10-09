// Writes a release version into a package.json without committing it (semantic-release's prepare step).
// Usage: bun scripts/set-package-version.ts <package.json> <version>
const [path, version] = process.argv.slice(2)
if (!path || !version) throw new Error("Usage: set-package-version.ts <package.json> <version>")

const file = Bun.file(path)
const pkg = await file.json()
pkg.version = version
await Bun.write(path, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`${pkg.name}@${version}`)
