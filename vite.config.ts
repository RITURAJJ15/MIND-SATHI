import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { geminiBackendPlugin } from './src/server/geminiProxyPlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    geminiBackendPlugin(),
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
});

