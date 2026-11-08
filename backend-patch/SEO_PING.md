# Telling search engines when a listing changes (optional backend hook)

The web app cannot observe database writes: it only reads the Laravel API. Sitemaps and listing pages
therefore follow the catalogue through short CDN lifetimes (≤ 15 min for sitemaps, ≤ 5 min for pages), and
`/api/ops?op=cron` sends the daily IndexNow batch for everything created/updated in the last 26 h.

For instant notification of **publish / update / delete / sold** (including deletions, which the daily batch cannot
see), call the webhook from the Laravel app after the write commits:

```php
// app/Observers/ProductObserver.php  (register in AppServiceProvider::boot: Product::observe(ProductObserver::class))
public function saved(Product $p): void   { $this->ping($p); }
public function deleted(Product $p): void { $this->ping($p); }

private function ping(Product $p): void
{
    $slug = trim(preg_replace('/[^\p{L}\p{N}-]+/u', '', preg_replace('/[\s_]+/u', '-', mb_strtolower($p->name.' '.explode(',', (string) $p->location)[0]))), '-');
    $slug = mb_substr(preg_replace('/-{2,}/', '-', $slug), 0, 70);
    $path = '/listing/'.($slug ? "$slug-" : '').$p->id;

    \Illuminate\Support\Facades\Http::withHeaders(['x-seo-secret' => config('services.seo.ping_secret')])
        ->timeout(3)->async()
        ->post('https://www.souqna.net/api/ops?op=ping', ['urls' => [$path, '/']]);
}
```

Set the same value as `SEO_PING_SECRET` in the Vercel project. IndexNow is honoured by Bing, Yandex, Seznam and
Naver; Google does not support it and learns about changes from the sitemaps. Submitting a URL never guarantees
indexing.
