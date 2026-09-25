/**
 * COSInput - Backend Server Entrypoint
 * Express server running on port 3000 with GitHub API proxy endpoints
 * and Vite middlewares in development.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { githubRouter } from './server/routes';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Capture rawBody for cryptographic webhook HMAC verification
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Mount GitHub integration API routes
  app.use('/api/github', githubRouter);

  // Mount OAuth callback alias at root level (/auth/callback)
  app.use('/auth/callback', (req, res, next) => {
    req.url = '/user/callback' + (req.url === '/' ? '' : req.url);
    githubRouter(req, res, next);
  });

  // Basic healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'COSInput Server',
      version: '0.2',
      timestamp: new Date().toISOString(),
    });
  });

  // Development vs Production serving
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[COSInput] Full-stack server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[COSInput] Fatal server error:', err);
  process.exit(1);
});
