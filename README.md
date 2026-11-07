# trazzo-world

Local workspace. Run every command from this directory. More context: [`profile/README.md`](profile/README.md).

## Copy-paste

### Link local `@trazzoapp/*` into every app

```bash
./scripts/link-packages.sh
```

### Link into one app only

```bash
./scripts/link-packages.sh trazzo-webapp
```

```bash
./scripts/link-packages.sh trazzo-api
```

```bash
./scripts/link-packages.sh trazzo-app
```

```bash
./scripts/link-packages.sh trazzo-admin
```

```bash
./scripts/link-packages.sh trazzo-clients
```

```bash
./scripts/link-packages.sh trazzo-landing
```

```bash
./scripts/link-packages.sh trazzo-marketplace
```

### Unlink (back to published GitHub Packages versions)

```bash
./scripts/unlink-packages.sh
```

### Unlink one app only

```bash
./scripts/unlink-packages.sh trazzo-webapp
```

### Rebuild shared packages after you edit them

```bash
pnpm build:packages
```

### Start every app (links first, opens consoles + dashboard)

```bash
pnpm dev:all
```

### Start every app without linking again

```bash
SKIP_LINK=1 ./scripts/dev-all.sh
```

### Stop every app + dashboard

```bash
pnpm stop:all
```

### Dashboard only

```bash
pnpm dashboard
```

<http://127.0.0.1:3999>

### Start one app (current terminal, does not link)

```bash
pnpm dev:landing
```

<http://localhost:3000>

```bash
pnpm dev:api
```

<http://localhost:3001> · docs: <http://localhost:3001/docs>

```bash
pnpm dev:webapp
```

<http://localhost:3002>

```bash
pnpm dev:clients
```

<http://localhost:3003>

```bash
pnpm dev:marketplace
```

<http://localhost:3004>

```bash
pnpm dev:admin
```

<http://localhost:3005>

```bash
pnpm dev:app
```

<http://localhost:8081> (Expo)

```bash
pnpm dev:worker
```

No HTTP. Logs only.
