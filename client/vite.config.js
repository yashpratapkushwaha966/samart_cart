import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the browser talks only to Vite (port 5173); Vite forwards API calls to Express (port 5000).
// That keeps cookies same-origin, exactly like production.
const api = 'http://localhost:5000';
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // lets a phone on the same Wi-Fi open http://<your-pc-ip>:5173
    port: 5173,
    proxy: { '/api': api, '/uploads': api, '/socket.io': { target: api, ws: true } },
  },
});
