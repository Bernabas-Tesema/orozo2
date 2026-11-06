import type { Request, Response } from 'express';
import { createApiApp } from './app';

const app = createApiApp();

export default function handler(req: Request, res: Response) {
  try {
    app(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: message });
    }
  }
}
