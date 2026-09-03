import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages sirve el sitio bajo /rive-showcase/
export default defineConfig({
  plugins: [react()],
  base: '/rive-showcase/',
});
