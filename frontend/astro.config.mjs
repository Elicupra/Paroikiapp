import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  vite: {
    define: {
      __API_URL__: JSON.stringify(process.env.API_URL || 'http://localhost:3001'),
    },
  },
});
