# Deploying

`main` is the only long-lived branch: pull requests target it and are squash merged, with conventional commit titles. Merging deploys nothing: production moves when a release is published.

## Releases

[Release](../.github/workflows/release.yml) runs [release-please](https://github.com/googleapis/release-please) once [CI](../.github/workflows/check.yml) has passed on `main`'s latest commit, so a red `main` neither proposes nor publishes a release, and a release commit has passed Check before Deploy starts. It keeps a release pull request open per package, with the next version worked out from the squashed PR titles since the last release, and its `CHANGELOG.md` entry:

| Package                     | Commits                               | Tag                 | Merging the release PR runs    |
| --------------------------- | ------------------------------------- | ------------------- | ------------------------------ |
| app and ingest (`.`)        | all                                   | `v<version>`        | [Deploy](#deploy)              |
| `@better-bull-board/client` | those touching `packages/client` only | `client-v<version>` | [Publish](publishing.md) (npm) |

| Commit type                                        | Release                          |
| -------------------------------------------------- | -------------------------------- |
| `fix`, `perf`, `refactor`, `build`, `revert`       | patch                            |
| `feat`                                             | minor                            |
| `!` after the type, or a `BREAKING CHANGE:` footer | major                            |
| `docs`, `test`, `ci`, `chore`                      | none: they wait for the next one |

The release PR stays open while more merges land, and updates itself; merge it when the release should go out. Each Release run rebuilds both release PRs from `main` (`always-update`): both change `.release-please-manifest.json`, so merging one would otherwise leave the other in conflict. The config is [`release-please-config.json`](../release-please-config.json), and [`.release-please-manifest.json`](../.release-please-manifest.json) holds the current versions.

## Deploy

[Deploy](../.github/workflows/deploy.yml) runs on a published `v*` release. A first job refuses a commit that is not on `main` or whose **Check** did not pass, then one job per image (app, ingest) builds it, pushes it to ECR tagged with the commit, and rolls it out. An image whose sources did not change since the commit running in the cluster is neither built nor rolled out.

Run it by hand to deploy again, or to roll back (or forward) to another release or any commit of `main`. A manual run builds both images:

```bash
gh workflow run deploy.yml
```

```bash
gh workflow run deploy.yml -f ref=v1.2.0
```

## Setup

- Release acts as the `dimension-release` GitHub App (`vars.RELEASE_APP_CLIENT_ID` and `secrets.RELEASE_APP_PRIVATE_KEY`, at the repository level), not with `GITHUB_TOKEN`: what that token creates runs no workflow, so Check would never run on the release PR and the release would never start Deploy or Publish. The app needs contents, issues and pull requests write access to this repository.
- Deploy reads `secrets.KUBECONFIG_CONTENT` (organization) and `secrets.AWS_ACCESS_KEY_ID` / `secrets.AWS_SECRET_ACCESS_KEY` (repository).
