# AGENTS.md

## Cursor Cloud specific instructions

- **Repository state (as of initial setup):** The AJAWAI-2.1 repo is a newly initialized Node.js project scaffold containing only `README.md` and `.gitignore`. There is no application code, `package.json`, tests, or linting configuration yet.
- **Runtime:** Node.js v22 is available via nvm (with npm, pnpm, and yarn pre-installed). The `.gitignore` covers Node.js, Next.js, Nuxt, Vite, and SvelteKit patterns.
- **Dependencies:** Once a `package.json` is added, install dependencies with the package manager matching the lockfile (`package-lock.json` → npm, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm). If no lockfile exists yet, prefer pnpm.
- **No services to start:** There are currently no services, dev servers, or databases required.
