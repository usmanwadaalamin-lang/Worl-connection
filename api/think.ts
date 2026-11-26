import type { IncomingMessage, ServerResponse } from 'http';
import { handleThink } from '../server/apiHandlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleThink(req, res);
}
