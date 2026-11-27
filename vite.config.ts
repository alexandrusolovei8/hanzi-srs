import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from https://<user>.github.io/hanzi-srs/
export default defineConfig({
  base: '/hanzi-srs/',
  plugins: [react()],
});
