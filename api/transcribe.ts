import type { IncomingMessage, ServerResponse } from 'http';
import { handleTranscribe } from '../server/apiHandlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleTranscribe(req, res);
}
