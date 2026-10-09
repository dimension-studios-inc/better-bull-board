/**
 * Releases @better-bull-board/client from main (see docs/publishing.md). Run from packages/client (`bun run
 * release:client`): semantic-release only reads its config from the working directory, and
 * semantic-release-monorepo only hands the plugins the commits that touch it.
 *
 * The version lives in the client-v* tags and is written into package.json at publish time, never committed:
 * main stays a commit of develop, which Promote fast-forwards.
 *
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  extends: "semantic-release-monorepo",
  branches: ["main"],
  // oxlint-disable-next-line eslint/no-template-curly-in-string -- semantic-release expands this placeholder at runtime.
  tagFormat: "client-v${version}",
  plugins: [
    // Defaults for a library: feat → minor, fix/perf/revert → patch, `!` or BREAKING CHANGE → major
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    [
      "@semantic-release/exec",
      {
        // oxlint-disable-next-line eslint/no-template-curly-in-string -- semantic-release expands this placeholder at runtime.
        prepareCmd: "bun ../../scripts/set-package-version.ts package.json ${nextRelease.version}",
        // bun pm pack rewrites workspace: ranges; npm publishes the tarball through trusted publishing (OIDC)
        publishCmd: 'bun run pack:check && npm publish "$(bun pm pack --quiet)" --access public',
      },
    ],
    ["@semantic-release/github", { labels: false }],
  ],
}
