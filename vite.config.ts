import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served from https://kaankurtoglu8.github.io/turanslate/, so every asset URL is
// prefixed with /turanslate/ (dev server included, to catch base-path mistakes early).
export default defineConfig({
  base: '/turanslate/',
  plugins: [react()],
  build: {
    sourcemap: false,
  },
});
