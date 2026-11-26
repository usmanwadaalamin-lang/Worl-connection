import type { IncomingMessage, ServerResponse } from 'http';
import { handleShortenLink } from '../server/apiHandlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleShortenLink(req, res);
}
