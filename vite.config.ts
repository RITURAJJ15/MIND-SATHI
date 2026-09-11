import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { geminiBackendPlugin } from './src/server/geminiProxyPlugin';

function caregiverRewritePlugin(): Plugin {
  return {
    name: 'caregiver-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          const [urlPath, query] = req.url.split('?');
          if (urlPath === '/caregiver' || urlPath === '/caregiver/') {
            req.url = '/caregiver.html' + (query ? `?${query}` : '');
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    geminiBackendPlugin(),
    caregiverRewritePlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        caregiver: path.resolve(__dirname, 'caregiver.html'),
      },
    },
  },
});
