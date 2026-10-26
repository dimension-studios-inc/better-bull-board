# Publishing `@better-bull-board/client`

Released by [release-please](https://github.com/googleapis/release-please) with the app (see [Deploying](deploying.md#releases)), as its own package: its release PR only counts the commits that touch `packages/client`, so a `feat(app): …` does not release the client. Nobody bumps the version by hand. Renovate opens separate `chore(client-deps): …` PRs for the client's devDependencies, which do not reach consumers; its `fix(deps): …` updates of runtime dependencies release a patch.

Merging the client's release PR updates `packages/client/CHANGELOG.md` and the manifest, and publishes the `client-vX.Y.Z` GitHub release, which runs [Publish](../.github/workflows/publish.yml):

1. Writes the version from the tag into `packages/client/package.json`, without committing it.
2. Builds and packs the client with `bun pm pack` (which rewrites `workspace:` ranges) and publishes the tarball with `npm publish`.

The version lives in the `client-v*` tags and in [`.release-please-manifest.json`](../.release-please-manifest.json); in the repository, `package.json` keeps `0.0.0-development`. Committing it would leave `bun.lock`, which records workspace versions, behind after every release, until the next `bun install` rewrites it in an unrelated PR. To retry a failed publish, re-run its Publish run.

Publishing uses [npmjs trusted publishing](https://docs.npmjs.com/trusted-publishers/) (GitHub OIDC). There is no `NPM_TOKEN`. The trusted publisher on the [package settings](https://www.npmjs.com/package/@better-bull-board/client?activeTab=settings) must match:

- Organization: `dimension-studios-inc`
- Repository: `better-bull-board`
- Workflow filename: `publish.yml`
- Environment: leave empty
- Allowed actions: `npm publish` (npmjs UI label)
