import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for Doodle Dash client
// Sets dev server to port 5173 and proxies /socket.io (WebSocket) and /api to Express (port 3001)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3001',
      },
    },
  },
});
