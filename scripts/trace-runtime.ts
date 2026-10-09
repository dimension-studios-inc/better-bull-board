// Copies only the files the entries need at runtime (Next's `standalone` approach) into <out-dir>.
// Adapted from the main repo's scripts/trace-runtime.ts, for a Node runner on Alpine (musl).
// Usage: node scripts/trace-runtime.ts <entry>... <out-dir>
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  symlinkSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

import { nodeFileTrace } from "@vercel/nft"

const entries = process.argv.slice(2)
const outDir = entries.pop()
if (!outDir || entries.length === 0) throw new Error("Usage: trace-runtime.ts <entry>... <out-dir>")

const base = process.cwd()
const listTree = (dir: string): string[] =>
  readdirSync(join(base, dir)).flatMap((name) => {
    const path = join(dir, name)
    return lstatSync(join(base, path)).isDirectory() ? listTree(path) : [path]
  })
/** `…/node_modules/@scope/pkg/lib/x.js` → `…/node_modules/@scope/pkg`; undefined outside node_modules. */
const packageDirOf = (file: string) => {
  const at = file.lastIndexOf("node_modules/")
  if (at === -1) return undefined
  const parts = file.slice(at + "node_modules/".length).split("/")
  return `${file.slice(0, at)}node_modules/${parts.slice(0, parts[0]?.startsWith("@") ? 2 : 1).join("/")}`
}
// Bun's isolated linker resolves undeclared packages through this folder, as pnpm does with `.pnpm/node_modules`.
const HOISTED = "node_modules/.bun/node_modules"
// Packages that load their own files by computed path (bullmq's worker-thread main), which tracing
// cannot follow: shipped whole once the key package is traced.
const SHIP_WHOLE: Record<string, string[]> = {
  bullmq: ["bullmq"],
}

// A path built from process.cwd() (ingest's `packages/db` for drizzle-kit) makes nft ship the whole folder as
// assets; its build config would then pull tsdown, rolldown and typescript.
const ignore = ["**/tsdown.config.*", "**/.turbo/**", "**/debug/**"]
// Run with node, the runner's runtime: nft skips `module.builtinModules`, which under bun include `ws`.
const trace = async (entries: string[]) => {
  const { fileList } = await nodeFileTrace(entries, { base, conditions: ["node"], ignore })
  return new Set(fileList)
}
let fileList = await trace(entries)
const wholeFiles = Object.entries(SHIP_WHOLE)
  .filter(([key]) => [...fileList].some((file) => packageDirOf(file)?.endsWith(`/node_modules/${key}`)))
  .flatMap(([, names]) => names.flatMap((name) => listTree(relative(base, realpathSync(join(base, HOISTED, name))))))
// Their files become entries too, so the dependencies they load are traced; not their published tool configs.
const wholeEntries = wholeFiles.filter((file) => /\.(c|m)?js$/.test(file) && !/\.config\.(c|m)?js$/.test(file))
if (wholeEntries.length > 0) fileList = await trace([...entries, ...wholeEntries])
const files = new Set([...fileList, ...wholeFiles])

// Only for packages whose code is traced: some libraries read other tools' package.json just to sniff versions.
const tracedPackageDirs = new Set([...fileList].filter((file) => !file.endsWith("/package.json")).map(packageDirOf))

// Platform binaries are optional dependencies picked by a computed require(), which tracing cannot follow.
for (const file of fileList) {
  if (!file.endsWith("/package.json") || !tracedPackageDirs.has(dirname(file))) continue
  const { optionalDependencies = {} } = JSON.parse(readFileSync(join(base, file), "utf8")) as {
    optionalDependencies?: Record<string, string>
  }
  // Installed optional deps are links beside the package in bun's isolated store; only this platform's exist.
  const siblings = file.slice(0, file.lastIndexOf("node_modules/") + "node_modules".length)
  for (const name of Object.keys(optionalDependencies)) {
    const link = join(siblings, name)
    if (!existsSync(join(base, link))) continue
    if (lstatSync(join(base, link)).isSymbolicLink()) files.add(link)
    for (const path of listTree(relative(base, realpathSync(join(base, link))))) files.add(path)
  }
}

// Links a computed require() resolves through: a package's siblings in the store, and the hoisted folder.
const linkDirs = new Set([
  HOISTED,
  ...[...tracedPackageDirs].filter((dir) => dir?.includes(".bun/")).map((dir) => dirname(dir as string)),
])
for (const dir of linkDirs) {
  if (!existsSync(join(base, dir))) continue
  for (const name of readdirSync(join(base, dir))) {
    const links = name.startsWith("@")
      ? readdirSync(join(base, dir, name)).map((sub) => join(dir, name, sub))
      : [join(dir, name)]
    for (const link of links) {
      if (!lstatSync(join(base, link)).isSymbolicLink()) continue
      const target = relative(base, resolve(base, dirname(link), readlinkSync(join(base, link))))
      if (tracedPackageDirs.has(target)) files.add(link)
    }
  }
}

// bun installs both libc builds of a native package: ship the runner's (musl). Filtered last, since some
// packages require both by literal name.
for (const file of files) {
  if (/-gnu/.test(packageDirOf(file)?.split("node_modules/").pop() ?? "")) continue
  const src = join(base, file)
  const dest = join(outDir, file)
  mkdirSync(dirname(dest), { recursive: true })
  if (lstatSync(src).isSymbolicLink()) {
    if (!lstatSync(dest, { throwIfNoEntry: false })) symlinkSync(readlinkSync(src), dest)
  } else {
    cpSync(src, dest)
  }
}
console.log(`trace-runtime: ${files.size} files from ${entries.join(", ")}`)
