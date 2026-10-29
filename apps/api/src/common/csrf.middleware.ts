import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@lexbridge/shared';
import { NextFunction, Request, Response } from 'express';

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'POST' && req.header(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
    res.status(403).json({ error: 'Missing CSRF header' });
    return;
  }
  next();
}
