# Trazzo

Trazzo is a multi-app product built as a set of independent repositories under the [trazzoapp](https://github.com/trazzoapp) organization, sharing a common package ecosystem. This document describes how the repositories fit together and how to set up a full local development environment.

## Repositories

| Repository | Description |
|---|---|
| [trazzo-api](https://github.com/trazzoapp/trazzo-api) | Backend API and worker services |
| [trazzo-app](https://github.com/trazzoapp/trazzo-app) | Mobile application (Expo) |
| [trazzo-clients](https://github.com/trazzoapp/trazzo-clients) | Client-facing web application (Next.js) |
| [trazzo-landing](https://github.com/trazzoapp/trazzo-landing) | Marketing landing page (Next.js) |
| [trazzo-packages](https://github.com/trazzoapp/trazzo-packages) | Shared packages published to GitHub Packages under the `@trazzoapp/*` scope (ui, core, icons, logger, api-client, mock-api, config, storybook) |
| [trazzo-webapp](https://github.com/trazzoapp/trazzo-webapp) | Main web application (Next.js) |

All repositories are private and are developed side by side in a single local working directory (`trazzo-world`), with this document itself kept as a root-level README there. Each repository manages its own git history, CI, and deployment pipeline independently.

## Shared packages (`@trazzoapp/*`)

Shared code lives in `trazzo-packages` and is distributed as versioned npm packages rather than consumed via local `file:` references between sibling folders. Packages are published to GitHub Packages (`npm.pkg.github.com`) under the `@trazzoapp` scope, and every consuming repository installs them as a normal versioned dependency (e.g. `"@trazzoapp/ui": "^0.1.0"`). This decoupling is required because hosting providers such as Vercel or EAS Build only clone the single repository they are connected to, with no access to sibling folders from another repository.

### Installing shared packages

To install `@trazzoapp/*` packages, both locally and in CI, add an `.npmrc` with:

```
@trazzoapp:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

and set the `NODE_AUTH_TOKEN` environment variable to a classic Personal Access Token with the `read:packages` scope (and `repo` if the package belongs to a private repository). On Vercel or in GitHub Actions, configure this token as a secret.

### Publishing a change

Bump the version in the affected package's `package.json` inside `trazzo-packages` and push to `main`. The `.github/workflows/publish.yml` workflow publishes the new version automatically.

### Iterating on a shared package without publishing

To iterate quickly on a shared package and see the effect in a consumer without going through a version bump, publish, and reinstall cycle, use the helper scripts in [`scripts/`](scripts):

```bash
# Link every consumer to your local trazzo-packages checkout
./scripts/link-packages.sh

# Or link a specific subset
./scripts/link-packages.sh trazzo-webapp

# Restore the published versions when done
./scripts/unlink-packages.sh
```

These scripts use `pnpm link` (global symlinks) and never modify any `package.json`. After editing a package in `trazzo-packages`, run `pnpm build` there (or `pnpm dev` inside the specific package for watch mode) so linked consumers pick up the change.

## Setting up the full workspace

Clone every repository into a shared parent directory, keeping the folder names below:

```bash
git clone git@github.com:trazzoapp/trazzo-api.git
git clone git@github.com:trazzoapp/trazzo-app.git
git clone git@github.com:trazzoapp/trazzo-clients.git
git clone git@github.com:trazzoapp/trazzo-landing.git
git clone git@github.com:trazzoapp/trazzo-packages.git
git clone git@github.com:trazzoapp/trazzo-webapp.git
```

Or, using the GitHub CLI over HTTPS with your authenticated session:

```bash
gh repo clone trazzoapp/trazzo-api
gh repo clone trazzoapp/trazzo-app
gh repo clone trazzoapp/trazzo-clients
gh repo clone trazzoapp/trazzo-landing
gh repo clone trazzoapp/trazzo-packages
gh repo clone trazzoapp/trazzo-webapp
```

Then install dependencies in each one (all projects use `pnpm`):

```bash
for d in trazzo-api trazzo-app trazzo-clients trazzo-landing trazzo-packages trazzo-webapp; do
  (cd "$d" && pnpm install)
done
```

## Convenience scripts

The root `package.json` is not a published package — it only exposes shortcuts that delegate to each subproject via `pnpm -C`:

```bash
pnpm dev:api         # start the backend
pnpm dev:webapp       # start the main web app
pnpm dev:clients      # start the client-facing web app
pnpm dev:landing      # start the landing page
pnpm dev:app          # start the mobile app (Expo)
pnpm dev:worker       # start the backend worker

pnpm build:api
pnpm build:webapp
pnpm build:clients
pnpm build:landing
pnpm build:packages

pnpm lint:api / lint:app / lint:clients / lint:landing / lint:webapp
pnpm typecheck:api / typecheck:app / typecheck:clients / typecheck:landing / typecheck:webapp / typecheck:packages
```

These scripts assume all six repositories are cloned alongside this `package.json`, as described above.

## Environment variables

Each repository manages its own environment variables (`.env`, `.env.local`, etc.), which are git-ignored and never committed. Refer to each project's `.env.example` or `.env.local.example` to see which variables need to be configured locally.
