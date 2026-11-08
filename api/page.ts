/**
 * Server-rendered entry point for every public page.
 *
 * vercel.json rewrites `/` and every extension-less path here. The function
 * resolves the route (home, category, city, listing, guides, private SPA
 * routes, 404), fetches the built SPA shell and returns it with the page's real
 * content, metadata and structured data in the first response, with the right
 * HTTP status. Browsers then boot the SPA on top of it as before.
 *
 * Failure policy: if the API is down we still serve the SPA shell (the app
 * fetches its own data); listings answer 503 so a crawler retries instead of
 * recording an empty page.
 */
import {httpBackend} from '../server/seo/backend.js';
import {first, loadShell, sendPage, type Req, type Res} from '../server/seo/http.js';
import {resolveRoute} from '../server/seo/pages.js';
import {SITE} from '../server/seo/config.js';

export default async function handler(req: Req, res: Res) {
  const host = first(req.headers['x-forwarded-host']) || first(req.headers.host) || new URL(SITE).host;
  const path = `/${first(req.query.path)}`;
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.query)) if (key !== 'path') query[key] = first(value);

  let shell: string;
  try {
    shell = await loadShell(host);
  } catch {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(502).send('Souqna is temporarily unavailable. Please try again shortly.');
    return;
  }

  try {
    sendPage(res, shell, await resolveRoute(httpBackend, {path, query}));
  } catch (error) {
    // Never take a page down because SEO enrichment failed: serve the plain shell.
    console.error('page render failed', path, (error as Error).message);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(path.startsWith('/listing/') ? 503 : 200).send(shell);
  }
}
