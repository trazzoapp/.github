# trazzo-world: guía para Claude

Workspace local que agrupa todos los repos de Trazzo. Cada carpeta `trazzo-*` es **su propio repo git** (org `trazzoapp`) con su propio `CLAUDE.md`/`AGENTS.md`: léelo antes de trabajar dentro. Esta raíz es el repo `trazzoapp/.github` (perfil de la org, scripts del workspace y el dashboard).

Ejecuta los comandos del workspace desde esta carpeta (`pnpm dev:webapp`, `pnpm typecheck:api`, etc. en [package.json](package.json)). Gestor de paquetes: **pnpm**.

## Alcance actual del producto

Solo **licencia B2B**: una empresa sube su catálogo (propiedades/desarrollos, modelo `listings`) y lo publica en su propio sitio (`empresa.trazzo.world`). Jerarquía: organización → proyecto → propiedad, con soft delete y activity log. CRM de obra, cotizador, app móvil y bolsa de trabajo son fases posteriores: no los propongas ni los construyas salvo que se pida.

## Repos

| Repo | Qué es | Stack | Estado en el alcance |
| --- | --- | --- | --- |
| [trazzo-packages](trazzo-packages) | Monorepo de paquetes compartidos `@trazzoapp/*`: `core` (contratos zod, IDs, errores), `api-client` (cliente tipado + TanStack Query), `mock-api` (MSW), `ui`, `icons`, `logger`, `config`, `storybook`, `docs/design-system` | pnpm workspace, changesets | Central: todo cambio de contrato empieza aquí |
| [trazzo-api](trazzo-api) | Backend HTTP único para webapp, clients y app. Contratos de `@trazzoapp/core`; sin lógica de negocio en Supabase (ni Edge Functions ni triggers con reglas) | Hono + zod-openapi, Drizzle, Postgres/Supabase, pg-boss (worker), Vitest | Activo |
| [trazzo-webapp](trazzo-webapp) | Panel web de la empresa cliente: gestiona organización, proyectos y propiedades | Next.js, arquitectura por capas (`domain`/`application`/`ports`/`infrastructure`), next-intl, Supabase auth, Mapbox | Activo |
| [trazzo-clients](trazzo-clients) | Sitio público de cada empresa (multi-tenant por subdominio vía `proxy.ts`) | Next.js + react-native-web | Activo (aún tiene `trazzo.app` hardcodeado; el dominio es `trazzo.world`) |
| [trazzo-landing](trazzo-landing) | Landing de marketing de Trazzo | Next.js, next-intl, Vitest; contenido desde `trazzo-cms` | Activo |
| [trazzo-cms](trazzo-cms) | Strapi 5 para la landing: copy, blog, legales, ajustes. **No** guarda datos de clientes | Strapi, Postgres, Docker/Caddy | Activo |
| [trazzo-admin](trazzo-admin) | Panel interno de super admin (puerto 3005) | Next.js + react-native-web | Secundario |
| [trazzo-app](trazzo-app) | App móvil de obra | Expo / React Native; builds EAS solo desde la rama `release` (son de pago) | Fase futura |
| [trazzo-marketplace](trazzo-marketplace) | Bolsa de trabajo pública (puerto 3004) | Next.js + react-native-web | Fase futura |

En la raíz: [dashboard-app](dashboard-app) (Electron + Vite para arrancar/parar los repos) y [scripts](scripts) (`link-packages.sh`/`unlink-packages.sh` para enlazar `@trazzoapp/*` locales, `dev-all.sh`, `stop-all.sh`).

### Dependencias entre repos

`trazzo-packages` → (`core`, `api-client`, `ui`…) → `trazzo-api`, `trazzo-webapp`, `trazzo-clients`, `trazzo-landing`, `trazzo-admin`, `trazzo-app`, `trazzo-marketplace`.

Un cambio de contrato sigue este orden: `core` en packages → `trazzo-api` → regenerar tipos de `api-client` → apps consumidoras. Para probar sin publicar, enlaza con `./scripts/link-packages.sh <repo>` y desenlaza (`unlink-packages.sh`) antes de lint/commit.

## Cómo trabajar con los agentes

Hay dos subagentes en [.claude/agents](.claude/agents):

- **`explore`** (Haiku, solo lectura): para localizar código y responder "¿dónde/cómo se hace X?". Úsalo para barridos amplios entre repos; devuelve conclusiones con `ruta:línea`.
- **`implementer`** (Sonnet): implementa una tarea **ya aprobada** y la verifica (typecheck, lint, tests). No decide diseño ni amplía alcance.

Flujo:

1. **Entender**: lanza `explore` (en paralelo si hay varios repos implicados) para mapear el código afectado. No uses `implementer` para explorar.
2. **Planear**: con lo encontrado, la sesión principal propone un plan concreto (repos, archivos, orden según las dependencias de arriba) y **espera la aprobación del usuario**.
3. **Implementar**: un `implementer` por repo o por conjunto de archivos independiente, con la tarea aprobada escrita completa en el prompt (qué cambiar, dónde, criterio de hecho). Nunca dos implementers sobre los mismos archivos. Si un repo depende de otro (p. ej. api ← core), hazlos en orden, no en paralelo.
4. **Revisar**: la sesión principal comprueba el diff y los resultados de verificación que reporta el implementer antes de darlo por hecho. Lo que no se ejecutó se reporta como no verificado.

## Reglas de código (todos los repos)

Son obligatorias para la sesión principal y para los agentes. Si una tarea no puede cumplirlas, avisa en vez de saltártelas.

- **Tipado estricto.** Prohibido `any`, tanto explícito como implícito. Si el tipo es desconocido, usa `unknown` y estréchalo con un guard o con zod. También prohibidos `as any`, los `@ts-ignore` y los `@ts-expect-error` sin justificación, y el `!` (non-null assertion) para silenciar errores. Las funciones exportadas declaran el tipo de retorno. Los tipos de dominio vienen de `@trazzoapp/core`: no los redefinas a mano.
- **Un export por archivo.** Cada archivo expone una sola cosa (componente, hook, función, clase o schema), y el nombre del archivo coincide con ella. Excepciones:
  - un `index.ts` de barrel que solo re-exporta;
  - los exports que exige el framework (Next.js: `default` + `metadata`/`generateMetadata`/`generateStaticParams`, handlers de `route.ts`);
  - el tipo inferido de un schema zod, que puede ir junto al schema (`FooSchema` + `type Foo`).
- **Límite de tamaño.** Máximo **200 líneas por archivo** y unas **50 por función o componente**. Si te pasas, divide el archivo por responsabilidad (subcomponentes, hooks, helpers) en lugar de comprimir el código.
- **Sin código muerto ni de depuración.** Nada de `console.log` (usa `@trazzoapp/logger`), imports sin uso, código comentado o TODOs sin contexto.
- **Nombres y estructura.** Sigue la arquitectura de cada repo (p. ej. `domain`/`application`/`ports`/`infrastructure` en webapp). Usa nombres descriptivos, sin abreviaturas crípticas, y evita los números mágicos: muévelos a constantes con nombre.
- **Validación en los bordes.** Toda entrada externa (HTTP, formularios, env, respuestas de API) se valida con zod antes de usarse.
- **Lint y typecheck en verde.** Ningún cambio se da por terminado con errores de `typecheck` o `lint`. No desactives reglas con `eslint-disable` para pasar.

**ESLint (`@trazzoapp/config/eslint/base`)** hace cumplir estas reglas. Ya son **error**: `no-explicit-any`, `ban-ts-comment` y `no-console`. Siguen en **warn** mientras se migra el código existente: `explicit-module-boundary-types`, `no-non-null-assertion`, `max-lines`, `max-lines-per-function` y `trazzo/one-export-per-file`. Que estén en warn no significa que estén permitidas: el código nuevo no puede añadir warnings de estas reglas. Cuando un repo quede a 0, se suben a error.

Al tocar un archivo existente que incumple estas reglas, no lo refactorices entero sin pedirlo: cumple las reglas en lo que añadas y menciona el incumplimiento en el informe.

## Git (todos los repos)

GitHub Flow: rama desde `develop` (`feature/…`, `fix/…`, `chore/…`) → PR a `develop` → PR de `develop` a `main`. Hotfix desde `main` con back-merge a `develop`. **Nunca push directo a `main` ni `develop`.** Commits con convención commitlint (conventional commits). No hagas commit ni push sin que se pida.
