# AGENTS.md

## Cursor Cloud specific instructions

- **Stack:** React 19 + TypeScript + Vite 7 + Zustand + idb + lucide-react + clsx + vite-plugin-pwa.
- **Dev server:** `npm run dev` starts Vite on port 5173 (`--host` enabled in `vite.config.ts`).
- **Commands:** `npm run lint` (ESLint), `npm run build` (tsc + vite build), `npm run preview` (production preview).
- **PWA:** Configured via `vite-plugin-pwa` with workbox service worker; generated on `npm run build`.
- **AI pipeline:** All files in `src/ai/` are placeholders. `secretaryCore.ts` orchestrates the pipeline (memory -> prompt -> inference). No real model is loaded; responses are simulated.
- **IndexedDB:** `src/lib/db.ts` manages conversations and memory persistence via `idb`. Chat history survives page refresh.
- **CSS Modules:** Every component uses `*.module.css` co-located in its folder. Global styles/variables are in `src/styles/`.
