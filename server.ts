import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleShortenLink,
  handleSummarizeChat,
  handleThink,
  handleTranscribe,
  handleTranslate,
  handleVerifyEmailDomain,
  handleVerifyReceipt,
} from './server/apiHandlers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/verify-email-domain', handleVerifyEmailDomain);
  app.post('/api/think', handleThink);
  app.post('/api/verify-receipt', handleVerifyReceipt);
  app.post('/api/translate', handleTranslate);
  app.post('/api/transcribe', handleTranscribe);
  app.post('/api/summarize-chat', handleSummarizeChat);
  app.post('/api/shorten-link', handleShortenLink);

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const assetLinksPath = path.resolve(__dirname, 'public', '.well-known', 'assetlinks.json');
    if (fs.existsSync(assetLinksPath)) {
      res.type('application/json').sendFile(assetLinksPath);
      return;
    }
    res.status(404).json({ error: 'assetlinks.json not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath, { dotfiles: 'allow' }));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`World Connection server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
