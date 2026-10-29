import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api sang backend Express để frontend gọi API không bị lỗi CORS khi dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
