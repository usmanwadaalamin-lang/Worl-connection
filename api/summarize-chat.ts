import type { IncomingMessage, ServerResponse } from 'http';
import { handleSummarizeChat } from '../server/apiHandlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleSummarizeChat(req, res);
}
