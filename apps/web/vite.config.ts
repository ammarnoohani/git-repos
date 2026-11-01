import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Custom plugin to serve the root /data directory at /data in dev
function serveLocalData(): Plugin {
  return {
    name: 'serve-local-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const relativePath = req.url ? req.url.split('?')[0] : '';
        const filePath = path.resolve(__dirname, '../../data', `.${relativePath}`);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          const stream = fs.createReadStream(filePath);
          return stream.pipe(res);
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), serveLocalData()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@github-discovery/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts')
    }
  },
  server: {
    port: 3000,
    fs: {
      allow: ['..', '../..']
    }
  }
});
