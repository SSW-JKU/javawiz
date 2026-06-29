# Frontend

## Setup

Use the lockfile for a reproducible installation:

```sh
npm ci
```

Use `npm install` instead when intentionally changing dependencies.

## Commands

```sh
npm run dev           # Vite development server with hot module replacement
npm run check         # ESLint and TypeScript checks
npm run build         # Type-check and create the production dist directory
npm run build:analyze # Production build plus dist/bundle-report.html
npm run preview       # Locally inspect an existing production build
```

`npm run serve` remains an alias for `npm run dev` for compatibility with older
local tooling.

The Gradle `check` task runs ESLint, and the Gradle `build` task runs the
type-checked production build.

See the [Vite configuration reference](https://vite.dev/config/).

## Debugging

### VS Code

Open the Run and Debug view and start `Debug Frontend (Chrome)`. VS Code starts
`npm run dev`, waits for Vite on `http://localhost:5173`, and launches Chrome
with source maps enabled for Vue and TypeScript breakpoints.

### IntelliJ

When the whole `eInformatics` project is open in IntelliJ, run the shared
`:frontend:run` Gradle configuration to start Vite, then start
`Debug Frontend (Chrome)` to open `http://localhost:5173` with JavaScript
source-map debugging enabled for Vue and TypeScript breakpoints.

The debug configuration includes Vite URL mappings for `frontend` and the
`shared` alias so IntelliJ can resolve files served through `/@fs/...`.
