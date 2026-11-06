import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiApp } from './server/app';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = createApiApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Django client API: organization registration and interpreter records.
  // Local only. Vercel cannot reach a Django process on this machine.
  app.use('/django-api', async (req, res) => {
    const target = `http://127.0.0.1:8000${req.originalUrl.replace(/^\/django-api/, '')}`;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const accountId = req.header('x-account-id');
      if (accountId) headers['X-Account-Id'] = accountId;
      const response = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body ?? {}),
      });
      const text = await response.text();
      res.status(response.status).type('application/json').send(text);
    } catch {
      res.status(502).json({ error: 'The ORZO Django API is not running on port 8000.' });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ethiopian Interpretation Platform running on http://localhost:${PORT}`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Stop the process using it or run with another port, for example:`,
      );
      console.error('$env:PORT=3001; npm run dev');
    } else {
      console.error('Failed to start the HTTP server:', error);
    }
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
