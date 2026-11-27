import type { IncomingMessage, ServerResponse } from 'http';
import { handleYouTube } from '../server/apiHandlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleYouTube(req, res);
}
