import type { IncomingMessage, ServerResponse } from 'http';
import { handleTranslate } from '../server/apiHandlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleTranslate(req, res);
}
