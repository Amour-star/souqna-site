import {renderDocument, renderShellWithRobots} from './document.js';
import type {PageResult} from './pages.js';

export interface Req {
  method?: string;
  url?: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
export interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): Res;
  send(body: string): void;
  json(body: unknown): void;
  redirect(code: number, url: string): void;
}

export const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? '';

const shellCache = new Map<string, {at: number; html: string}>();

/** The built SPA (renamed to app-shell.html at build time so `/` reaches the function). */
export const loadShell = async (host: string): Promise<string> => {
  const hit = shellCache.get(host);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.html;
  const response = await fetch(`https://${host}/app-shell.html`, {signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error(`shell HTTP ${response.status}`);
  const html = await response.text();
  shellCache.set(host, {at: Date.now(), html});
  return html;
};

const cacheControl = (ttl: number) =>
  ttl > 0 ? `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${Math.max(ttl * 12, 3600)}` : 'no-store';

export const sendPage = (res: Res, shell: string, result: PageResult) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl(result.ttl));
  if (result.retryAfter) res.setHeader('Retry-After', String(result.retryAfter));
  if (result.redirect) {
    res.setHeader('Location', result.redirect);
    res.status(result.status).send('');
    return;
  }
  if (result.kind === 'doc' && result.doc) {
    if (!result.doc.indexable) res.setHeader('X-Robots-Tag', 'noindex, follow');
    res.status(result.status).send(renderDocument(shell, result.doc));
    return;
  }
  const robots = result.robots ?? 'noindex, follow';
  res.setHeader('X-Robots-Tag', robots);
  res.status(result.status).send(renderShellWithRobots(shell, robots, result.title));
};
