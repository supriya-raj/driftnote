import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Offline app shell (ADR 008): a service worker caches every built file at install
    // time ("precache"), so the app loads with no network after one online visit.
    VitePWA({
      // A new version waits until the user clicks "Reload" (see UpdatePrompt.tsx), so an
      // update never swaps code under someone in the middle of typing.
      registerType: "prompt",
      manifest: {
        name: "Driftnote",
        short_name: "Driftnote",
        description: "Local-first collaborative notes",
        start_url: "/",
        display: "standalone",
        theme_color: "#fbfaf8",
        background_color: "#fbfaf8",
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,svg}"],
        // Any in-app URL (e.g. /n/<id>) is answered with the cached index.html, and the
        // client-side router picks the page. Server endpoints are never faked.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/sync\//, /^\/healthz$/],
        // The first install takes control of open pages straight away.
        clientsClaim: true,
        // The editor bundle is ~1.4 MB; the default per-file limit is 2 MiB.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
});
