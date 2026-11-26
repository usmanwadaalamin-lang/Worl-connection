import type { IncomingMessage, ServerResponse } from 'http';
import { handleVerifyReceipt } from '../server/apiHandlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleVerifyReceipt(req, res);
}
