import type { IncomingMessage, ServerResponse } from 'http';
import { handleVerifyEmailDomain } from '../server/apiHandlers.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleVerifyEmailDomain(req, res);
}
