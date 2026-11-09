/**
 * IndexNow notification handler (Phase 9).
 *
 * Instantly alerts Bing, Yandex and participating search engines about newly
 * published, updated, or removed listings and landing pages.
 */

interface Req {
  method?: string;
  body?: string | {urls?: string[]; url?: string};
  query: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): Res;
  json(data: unknown): void;
  send(body: string): void;
}

const INDEXNOW_KEY = '41e4118f6c774b7189da3b10b3e64c29';
const HOST = 'www.souqna.net';
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;

export default async function handler(req: Req, res: Res) {
  res.setHeader('Content-Type', 'application/json');

  let urls: string[] = [];
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      urls = parsed.urls || (parsed.url ? [parsed.url] : []);
    } catch {
      // ignore
    }
  } else if (req.body && typeof req.body === 'object') {
    urls = req.body.urls || (req.body.url ? [req.body.url] : []);
  }

  if (!urls.length) {
    const single = req.query.url;
    if (typeof single === 'string') urls = [single];
  }

  // Fallback default url if none provided
  if (!urls.length) {
    urls = [`https://${HOST}/`];
  }

  // Filter and sanitize
  const urlList = urls
    .map(u => (u.startsWith('http') ? u : `https://${HOST}${u.startsWith('/') ? u : `/${u}`}`))
    .slice(0, 100);

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };

  try {
    const indexNowRes = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {'Content-Type': 'application/json; charset=utf-8'},
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    });

    res.status(200).json({
      success: true,
      submittedUrls: urlList.length,
      indexNowStatus: indexNowRes.status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
}
