# Publishing `@better-bull-board/client`

Released by [semantic-release](https://semantic-release.gitbook.io/) from [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) whenever [Promote](deploying.md) moves `main`. Nobody bumps the version by hand: it comes from the conventional commits that touch `packages/client` since the last `client-v*` tag.

| Commit | Release |
| --- | --- |
| `fix: …`, `perf: …`, `revert: …` | patch |
| `feat: …` | minor |
| `feat!: …` or a `BREAKING CHANGE:` footer | major |
| `chore`, `docs`, `refactor`, `test`, `ci`, … | none |

Commits that do not touch `packages/client` are ignored ([semantic-release-monorepo](https://github.com/pmowrer/semantic-release-monorepo)), so a `feat(app): …` does not publish the client. Renovate opens separate `chore(client-deps): …` PRs for the client's devDependencies, which do not reach consumers; its `fix(deps): …` updates of runtime dependencies publish a patch.

A release:

1. Computes the next version from the commits and writes it into `packages/client/package.json`, without committing it: the version only lives in the `client-v*` tags, and `main` stays a commit of `develop` for Promote. In the repository, `version` is `0.0.0-semantic-release`.
2. Builds and packs the client with `bun pm pack` (which rewrites `workspace:` ranges) and publishes the tarball with `npm publish`.
3. Pushes the `client-vX.Y.Z` tag, creates the GitHub release with the notes, and comments on the released PRs.

The config is [`packages/client/release.config.mjs`](../packages/client/release.config.mjs). To preview the next release from a clone with the tags: `cd packages/client && GITHUB_TOKEN=$(gh auth token) ../../node_modules/.bin/semantic-release --dry-run --no-ci --branches <current branch>`.

Publishing uses [npmjs trusted publishing](https://docs.npmjs.com/trusted-publishers/) (GitHub OIDC). There is no `NPM_TOKEN`. The trusted publisher on the [package settings](https://www.npmjs.com/package/@better-bull-board/client?activeTab=settings) must match:

- Organization: `dimension-studios-inc`
- Repository: `better-bull-board`
- Workflow filename: `publish.yml`
- Environment: leave empty
- Allowed actions: `npm publish` (npmjs UI label)
