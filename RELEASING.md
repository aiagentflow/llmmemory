# Releasing

Releases are published to npm by `.github/workflows/release.yml` when a `v*`
tag is pushed. It runs the typecheck and tests first, and refuses a tag that
does not match the version in `package.json`.

## One-time setup

On npmjs.com, open the llmmemory package settings and add a trusted publisher:
GitHub Actions, repository `aiagentflow/llmmemory`, workflow `release.yml`. No
token or secret is needed after that.

## Each release

1. Move the `Unreleased` entries in `CHANGELOG.md` under the new version.
2. Bump the version and tag it: `npm version minor` (or `patch`). This updates
   `package.json` and `src/version.ts` in one commit, and tags it.
3. Push the commit and the tag: `git push && git push --tags`.
4. Watch the `release` workflow in GitHub Actions.
