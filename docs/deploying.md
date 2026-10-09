# Deploying

`develop` is the integration branch: pull requests target it and are squash merged. `main` is what runs in production. A push to `main` runs [Deploy](../.github/workflows/deploy.yml) (app and ingest images, Kubernetes rollout) and [Publish](../.github/workflows/publish.yml) (a semantic-release of `@better-bull-board/client` when its commits call for one, see [Publishing](publishing.md)).

To deploy, run **Actions** → **Promote** → **Run workflow**. [`promote.yml`](../.github/workflows/promote.yml):

1. Requires a green **Check** on the `develop` tip ([`check.yml`](../.github/workflows/check.yml) runs on every push to `develop`).
2. Fast-forwards `main` to `develop` and pushes it with the release bot's GitHub App token: a push made with `GITHUB_TOKEN` would not start Deploy and Publish.

`main` therefore only ever holds commits from `develop`, with no merge commits, and the commit deployed is the one Check validated. Pull requests targeting `main` are rejected by [`guard-main.yml`](../.github/workflows/guard-main.yml) and by Check.

## Setup

- The `promote` environment holds the approval: add required reviewers in **Settings** → **Environments** → **promote**. GitHub creates the environment, without protection, on the first run.
- The workflow reads the release bot from `vars.RELEASE_BOT_CLIENT_ID` and `secrets.RELEASE_BOT_PRIVATE_KEY` (organization level), and the app needs contents write access to this repository.
- Promote fails if `main` has a commit that `develop` lacks: never commit or merge to `main` directly.
