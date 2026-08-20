# Publishing `@better-bull-board/client`

Published to npm from `main` by [`.github/workflows/publish.yml`](../.github/workflows/publish.yml). Merging `develop` into `main` publishes that version if it is not already on npm; otherwise the job skips.

1. Bump `version` in `packages/client/package.json` and merge that change to `develop`.
2. Merge `develop` into `main` (or run **Publish** → **Run workflow** on `main`).

Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) (GitHub OIDC). There is no `NPM_TOKEN`. Before the first successful run, add a GitHub Actions trusted publisher on the [package settings](https://www.npmjs.com/package/@better-bull-board/client?activeTab=settings):

- Organization: `dimension-studios-inc`
- Repository: `better-bull-board`
- Workflow filename: `publish.yml`
- Environment: leave empty
- Allowed actions: `npm publish`
