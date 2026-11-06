import express from 'express';
import type { Request } from 'express';
import apiRouter from './routes';

function splitUrl(raw: string) {
  const queryIndex = raw.indexOf('?');
  if (queryIndex < 0) {
    return { pathname: raw || '/', search: '' };
  }
  return {
    pathname: raw.slice(0, queryIndex) || '/',
    search: raw.slice(queryIndex),
  };
}

function searchWithoutCatchAll(search: string) {
  if (!search) return '';
  const params = new URLSearchParams(search.slice(1));
  params.delete('path');
  params.delete('__path');
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

function isMountedApiPath(pathname: string) {
  return (
    pathname === '/api/health' ||
    pathname.startsWith('/api/health/') ||
    pathname === '/api/v1' ||
    pathname.startsWith('/api/v1/')
  );
}

function catchAllSegments(req: Request): string[] | null {
  const queryPath = req.query?.__path ?? req.query?.path;
  if (Array.isArray(queryPath)) {
    const segments = queryPath.map(String).flatMap((part) => part.split('/')).filter(Boolean);
    return segments.length ? segments : null;
  }
  if (typeof queryPath === 'string' && queryPath) {
    const segments = queryPath.split('/').filter(Boolean);
    return segments.length ? segments : null;
  }
  return null;
}

function forwardedApiUrl(req: Request): string | null {
  const headerNames = [
    'x-forwarded-uri',
    'x-invoke-path',
    'x-original-url',
    'x-vercel-original-url',
    'x-rewrite-url',
  ];
  for (const name of headerNames) {
    const value = req.header(name);
    if (!value) continue;
    const raw = value.trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      try {
        const url = new URL(raw);
        if (url.pathname.startsWith('/api/')) return `${url.pathname}${url.search}`;
      } catch {
        continue;
      }
    } else if (raw.startsWith('/api/')) {
      return raw;
    }
  }
  return null;
}

/**
 * Vercel rewrites every `/api/*` request onto the single `api/index` function.
 * Express may then see the original `/api/v1/...` URL, only `/api`, or the
 * remainder in `__path`. Route matching expects `/api/v1/...`.
 */
function normalizeApiUrl(req: Request) {
  const { pathname: rawPath, search } = splitUrl(req.url || '/');
  const pathname = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  if (isMountedApiPath(pathname)) return;

  const cleanSearch = searchWithoutCatchAll(search);

  if (pathname === '/health') {
    req.url = `/api/health${cleanSearch}`;
    return;
  }

  if (pathname === '/v1' || pathname.startsWith('/v1/')) {
    req.url = `/api${pathname}${cleanSearch}`;
    return;
  }

  const stripped =
    pathname === '/' || pathname === '/api' || pathname === '/api/index';
  const segments = catchAllSegments(req);
  if (segments && stripped) {
    req.url = `/api/${segments.join('/')}${cleanSearch}`;
    return;
  }

  const forwarded = forwardedApiUrl(req);
  if (forwarded && stripped) {
    req.url = forwarded;
  }
}

export function createApiApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    normalizeApiUrl(req);
    next();
  });
  app.use('/api/v1', apiRouter);
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      platform: 'Ethiopian Language Interpretation Platform',
      version: '1.0.0-draft',
      time: new Date().toISOString(),
    });
  });
  return app;
}
