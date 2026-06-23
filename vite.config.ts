import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  base: '/',
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4000000,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'logoo.jpeg', 'link-up.png', 'logo.png'],
      manifest: {
        name: 'LinkUp Marketplace',
        short_name: 'LinkUp',
        description: 'Premium local marketplace connecting you with trusted services.',
        theme_color: '#E96F28',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        id: '/',
        icons: [
          {
            src: 'logoo.jpeg',
            sizes: '144x144',
            type: 'image/jpeg'
          },
          {
            src: 'logoo.jpeg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'logoo.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
