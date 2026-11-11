import {INDEXNOW_KEY, SITE} from './config.js';

export interface IndexNowResult {
  submitted: number;
  status: number | null;
  ok: boolean;
  error?: string;
}

/** Only URLs on our own host may be submitted (the protocol requires it). */
export const normaliseUrls = (urls: string[]): string[] => {
  const host = new URL(SITE).host;
  const out = new Set<string>();
  for (const raw of urls) {
    try {
      const url = new URL(raw, SITE);
      if (url.host === host && url.protocol === 'https:') out.add(url.toString());
    } catch {
      /* skip malformed */
    }
  }
  return [...out];
};

/**
 * Tells IndexNow-supporting engines (Bing, Yandex, Seznam, Naver…) that URLs
 * were added, changed or removed. Google does not support IndexNow — it learns
 * about changes from the sitemaps. A 200/202 means "received", never "indexed".
 */
export const submitIndexNow = async (urls: string[], fetchImpl: typeof fetch = fetch): Promise<IndexNowResult> => {
  const urlList = normaliseUrls(urls).slice(0, 10_000);
  if (!urlList.length) return {submitted: 0, status: null, ok: true};
  try {
    const response = await fetchImpl('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {'Content-Type': 'application/json; charset=utf-8'},
      body: JSON.stringify({host: new URL(SITE).host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList}),
      signal: AbortSignal.timeout(15_000),
    });
    return {submitted: urlList.length, status: response.status, ok: response.status === 200 || response.status === 202};
  } catch (error) {
    return {submitted: 0, status: null, ok: false, error: (error as Error).message};
  }
};
