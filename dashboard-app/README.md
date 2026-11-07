# Trazzo Control

Desktop app (Electron + React) to manage local development across every
`trazzo-*` repo in this monorepo from one window.

Auto-discovers any sibling folder with a `package.json` (no config file
needed) and shows, per repo:

- git branch, ahead/behind counts, dirty file count
- running state, with start/stop (runs its `dev`/`start` script via `pnpm`)
- its dev port, if detectable
- live streamed logs

It also lists every listening TCP port on the machine so you can kill
whatever is squatting on a port you need.

## Develop

```bash
npm install
npm run dev
```

## Build a local installer

```bash
npm run build:mac     # dmg + zip
npm run build:linux   # AppImage
npm run build:win     # nsis installer
```

Output lands in `dashboard-app/release/`.

## CI build

`.github/workflows/dashboard-release.yml` builds mac/linux/win artifacts:

- automatically on a pushed tag matching `dashboard-v*`
- on demand via the Actions tab ("Run workflow")

Each run uploads the installers as workflow artifacts you can download.
