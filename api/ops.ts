/**
 * Operational endpoints (one function to stay within plan limits):
 *
 *   /llms.txt                      public   — site summary for AI assistants
 *   /<indexnow-key>.txt            public   — IndexNow ownership file
 *   /api/ops?op=health[&deep=1]    admin    — SEO health report (Bearer SEO_ADMIN_TOKEN)
 *   /api/ops?op=cron               cron     — daily IndexNow for new/updated listings (Bearer CRON_SECRET)
 *   POST /api/ops?op=ping          backend  — publish/update/delete webhook (x-seo-secret: SEO_PING_SECRET)
 */
import {httpBackend, streamFeed} from '../server/seo/backend.js';
import {CRON_SECRET, INDEXNOW_KEY, PING_SECRET, SEO_ADMIN_TOKEN, SITE} from '../server/seo/config.js';
import {buildHealth} from '../server/seo/health.js';
import {first, type Req, type Res} from '../server/seo/http.js';
import {submitIndexNow} from '../server/seo/indexnow.js';
import {llmsTxt} from '../server/seo/llms.js';
import {isIndexableListing, listingPath} from '../server/seo/model.js';

const bearer = (req: Req) => first(req.headers.authorization).replace(/^Bearer\s+/i, '');

const deny = (res: Res, code = 401) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json({error: code === 503 ? 'disabled' : code === 405 ? 'method not allowed' : 'unauthorized'});
};

export default async function handler(req: Req, res: Res) {
  const op = first(req.query.op);

  if (op === 'llms') {
    const categories = await httpBackend.categories().catch(() => []);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(llmsTxt(categories));
    return;
  }

  if (op === 'indexnow-key') {
    if (first(req.query.key) !== INDEXNOW_KEY) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(INDEXNOW_KEY);
    return;
  }

  if (op === 'health') {
    if (!SEO_ADMIN_TOKEN) return deny(res, 503);
    if (bearer(req) !== SEO_ADMIN_TOKEN) return deny(res);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(await buildHealth(httpBackend, {deep: first(req.query.deep) === '1'}));
    return;
  }

  if (op === 'cron') {
    if (!CRON_SECRET) return deny(res, 503);
    if (bearer(req) !== CRON_SECRET) return deny(res);
    // Everything created or updated in the last 26 h (cron runs every 24 h).
    const since = Date.now() - 26 * 3600 * 1000;
    const urls: string[] = [`${SITE}/`];
    for await (const product of streamFeed(httpBackend, 0, 5000, 500)) {
      const stamp = Math.max(Date.parse(product.updated_at ?? '') || 0, Date.parse(product.created_at ?? '') || 0);
      if (stamp >= since && isIndexableListing(product)) urls.push(`${SITE}${encodeURI(listingPath(product))}`);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({urls: urls.length, indexnow: await submitIndexNow(urls)});
    return;
  }

  if (op === 'ping') {
    if (req.method !== 'POST') return deny(res, 405);
    if (!PING_SECRET) return deny(res, 503);
    if (first(req.headers['x-seo-secret']) !== PING_SECRET) return deny(res);
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {urls?: string[]} | undefined;
    const urls = Array.isArray(body?.urls) ? body.urls.filter(item => typeof item === 'string').slice(0, 1000) : [];
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({indexnow: await submitIndexNow(urls)});
    return;
  }

  res.status(404).send('Not found');
}
