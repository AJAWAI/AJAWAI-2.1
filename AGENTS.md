# AGENTS.md

## Cursor Cloud specific instructions

- **Stack:** React 19 + TypeScript + Vite 7 + Zustand + idb + lucide-react + clsx + vite-plugin-pwa.
- **Dev server:** `npm run dev` starts Vite on port 5173 (`--host` enabled in `vite.config.ts`).
- **Commands:** `npm run lint` (ESLint), `npm run build` (tsc + vite build), `npm run preview` (production preview).
- **PWA:** Configured via `vite-plugin-pwa` with workbox service worker; generated on `npm run build`.
- **AI runtime:** Phi-3.5 Mini loads via Transformers.js + WebGPU in browser.
  - Model: `onnx-community/Phi-3.5-mini-instruct-onnx-web` (Q4F16 quantization)
  - Safe mode skips smoke test to prevent mobile browser crashes
  - First user message serves as live readiness test
  - Moondream2 and STEP-3-VL are in registry but not browser-ready yet
- **IndexedDB:** `src/lib/db.ts` manages conversations and memory persistence via `idb`. Chat history survives page refresh.
- **CSS Modules:** Every component uses `*.module.css` co-located in its folder. Global styles/variables are in `src/styles/`.
