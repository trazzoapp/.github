# trazzo-world

Carpeta de trabajo local que agrupa los repositorios del proyecto Trazzo. Esta carpeta en sí **no es un repositorio git** — cada subcarpeta es su propio repo independiente en GitHub, bajo la organización [trazzoapp](https://github.com/trazzoapp):

| Carpeta | Repo | Descripción |
|---|---|---|
| `trazzo-api` | [trazzoapp/trazzo-api](https://github.com/trazzoapp/trazzo-api) | Backend / API |
| `trazzo-app` | [trazzoapp/trazzo-app](https://github.com/trazzoapp/trazzo-app) | App móvil (Expo) |
| `trazzo-clients` | [trazzoapp/trazzo-clients](https://github.com/trazzoapp/trazzo-clients) | Web de clientes (Next.js) |
| `trazzo-landing` | [trazzoapp/trazzo-landing](https://github.com/trazzoapp/trazzo-landing) | Landing page (Next.js) |
| `trazzo-packages` | [trazzoapp/trazzo-packages](https://github.com/trazzoapp/trazzo-packages) | Paquetes compartidos, publicados en GitHub Packages bajo el scope `@trazzoapp/*` (ui, core, icons, logger, api-client, mock-api, config, storybook) |
| `trazzo-webapp` | [trazzoapp/trazzo-webapp](https://github.com/trazzoapp/trazzo-webapp) | Web app principal (Next.js) |

Todos los repos son **privados**.

## Paquetes compartidos (`@trazzoapp/*`)

Los paquetes de `trazzo-packages` ya no se consumen vía `file:` entre carpetas hermanas — se publican a GitHub Packages (`npm.pkg.github.com`) bajo el scope `@trazzoapp`, y cada repo consumidor los instala como una dependencia normal con versión (`"@trazzoapp/ui": "^0.1.0"`). Esto es necesario porque hosts como Vercel o EAS build solo clonan el repo que les conectas, sin acceso a carpetas hermanas de otro repo.

Para instalar estos paquetes (local o en CI) necesitas un `.npmrc` con:

```
@trazzoapp:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

y la variable de entorno `NODE_AUTH_TOKEN` con un Personal Access Token classic (scopes `read:packages`, y `repo` si el paquete es de un repo privado). En Vercel/GitHub Actions, configúrala como secret.

Publicar un cambio: bump de versión en el `package.json` del paquete afectado dentro de `trazzo-packages` y push a `main` — el workflow `.github/workflows/publish.yml` publica automáticamente.

### Probar cambios de `trazzo-packages` sin publicar

Para iterar rápido en un paquete compartido y ver el efecto en un consumidor sin pasar por bump de versión + publish + reinstall, usa los scripts en [`scripts/`](scripts):

```bash
# Enlaza todos los consumidores a tu checkout local de trazzo-packages
./scripts/link-packages.sh

# O solo uno/algunos
./scripts/link-packages.sh trazzo-webapp

# Cuando termines, vuelve a las versiones publicadas
./scripts/unlink-packages.sh
```

Esto usa `pnpm link` (symlinks globales), no modifica ningún `package.json`. Después de editar un paquete en `trazzo-packages`, corre `pnpm build` ahí (o `pnpm dev` dentro del paquete específico para watch mode) para que el consumidor enlazado vea el cambio.

## Clonar todo

Clona cada repo dentro de esta misma carpeta (`trazzo-world`), conservando los nombres de carpeta:

```bash
git clone git@github.com:trazzoapp/trazzo-api.git
git clone git@github.com:trazzoapp/trazzo-app.git
git clone git@github.com:trazzoapp/trazzo-clients.git
git clone git@github.com:trazzoapp/trazzo-landing.git
git clone git@github.com:trazzoapp/trazzo-packages.git
git clone git@github.com:trazzoapp/trazzo-webapp.git
```

O con `gh` (HTTPS, usa tu sesión autenticada):

```bash
gh repo clone trazzoapp/trazzo-api
gh repo clone trazzoapp/trazzo-app
gh repo clone trazzoapp/trazzo-clients
gh repo clone trazzoapp/trazzo-landing
gh repo clone trazzoapp/trazzo-packages
gh repo clone trazzoapp/trazzo-webapp
```

Después instala dependencias en cada uno (todos usan `pnpm`):

```bash
for d in trazzo-api trazzo-app trazzo-clients trazzo-landing trazzo-packages trazzo-webapp; do
  (cd "$d" && pnpm install)
done
```

## Scripts de conveniencia

El `package.json` de esta carpeta raíz no es un paquete publicado, solo expone atajos que delegan en cada subproyecto vía `pnpm -C`:

```bash
pnpm dev:api        # levanta el backend
pnpm dev:webapp      # levanta la web app
pnpm dev:clients     # levanta la web de clientes
pnpm dev:landing     # levanta la landing
pnpm dev:app         # levanta la app móvil (Expo)
pnpm dev:worker      # levanta el worker del backend

pnpm build:api
pnpm build:webapp
pnpm build:clients
pnpm build:landing
pnpm build:packages

pnpm lint:api / lint:app / lint:clients / lint:landing / lint:webapp
pnpm typecheck:api / typecheck:app / typecheck:clients / typecheck:landing / typecheck:webapp / typecheck:packages
```

Estos scripts asumen que las 6 carpetas existen junto a este `package.json`, como se obtiene siguiendo los pasos de clonado de arriba.

## Variables de entorno

Cada repo gestiona sus propias variables de entorno (`.env`, `.env.local`, etc.), que están en `.gitignore` y nunca se suben a GitHub. Revisa el `.env.example` / `.env.local.example` de cada proyecto para saber qué variables configurar localmente.
