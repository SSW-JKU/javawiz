# frontend

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run serve
```

### Compiles and minifies for production
```
npm run build
```

### Lints and fixes files
```
npm run lint
```

### Debugs in VS Code

Open the Run and Debug view and start `Debug Frontend (Chrome)`. VS Code starts `npm run serve`, waits for Vite on `http://localhost:5173`, and launches Chrome with source maps enabled for Vue and TypeScript breakpoints.

### Debugs in IntelliJ

When the whole `eInformatics` project is open in IntelliJ, run the shared `:frontend:run` Gradle configuration to start Vite, then start `Debug Frontend (Chrome)` to open `http://localhost:5173` with JavaScript source-map debugging enabled for Vue and TypeScript breakpoints.
The debug configuration includes Vite URL mappings for `frontend` and the `shared` alias so IntelliJ can resolve files served through `/@fs/...`.

### Customize configuration
See [Vite Configuration Reference](https://vite.dev/config/).
