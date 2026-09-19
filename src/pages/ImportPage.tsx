import {useCallback, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {Button, Field, Input} from '@/components/ui';
import {SUPPORT_EMAIL} from '@/lib/config';
import {
  IN_PROGRESS,
  clearImportSession,
  getImportStatus,
  importErrorMessage,
  importErrorText,
  isDoushProfileUrl,
  loadImportSession,
  saveImportSession,
  startImport,
  verifyImport,
  type ImportProgress,
  type ImportStart,
} from '@/lib/api/import';
import './import.css';

type Phase = 'form' | 'code' | 'working' | 'done';

const POLL_MS = 3000;
/** An import reads up to 60 ads politely (about 1.2 s apart); stop waiting after this long. */
const POLL_GIVE_UP_MS = 12 * 60 * 1000;

const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const ImportPage = () => {
  const {t} = useTranslation();
  useSeo({
    title: t('import.title'),
    description: t('import.subtitle'),
    canonicalPath: '/import',
  });

  const [phase, setPhase] = useState<Phase>('form');
  const [profileUrl, setProfileUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<ImportStart | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pollStartedAt = useRef(0);

  const reset = useCallback(() => {
    clearImportSession();
    setSession(null);
    setProgress(null);
    setError(null);
    setConsent(false);
    setPhase('form');
  }, []);

  /** Applies a status the server reported, moving the page to the right step. */
  const applyProgress = useCallback((next: ImportProgress) => {
    setProgress(next);
    if (next.status === 'imported') {
      clearImportSession();
      setError(null);
      setPhase('done');
    } else if (IN_PROGRESS.includes(next.status)) {
      setPhase('working');
    } else if (next.status === 'pending') {
      // Back to the code step: the code is still valid, the seller can fix things and try again.
      setError(importErrorText(next.error));
      setPhase('code');
    } else if (next.status === 'failed' || next.status === 'expired' || next.status === 'rejected') {
      // This request is finished; start over.
      clearImportSession();
      setSession(null);
      setError(importErrorText(next.error ?? (next.status === 'expired' ? 'code_expired' : 'internal_error')));
      setPhase('form');
    }
  }, []);

  // Resume after a reload: the code is only ever shown once, so we keep it for this tab.
  useEffect(() => {
    const saved = loadImportSession();
    if (!saved) return;
    setSession(saved);
    setPhase('code');
    getImportStatus(saved.requestId)
      .then(applyProgress)
      .catch(() => {
        /* keep showing the saved code; verifying will surface any real problem */
      });
  }, [applyProgress]);

  // Countdown while the code is on screen.
  useEffect(() => {
    if (phase !== 'code') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Poll while the server reads the ads.
  useEffect(() => {
    if (phase !== 'working' || !session) return;
    pollStartedAt.current = pollStartedAt.current || Date.now();
    let cancelled = false;
    const id = window.setInterval(async () => {
      if (Date.now() - pollStartedAt.current > POLL_GIVE_UP_MS) {
        window.clearInterval(id);
        setError(importErrorText('timeout'));
        setPhase('code');
        return;
      }
      try {
        const next = await getImportStatus(session.requestId);
        if (!cancelled) applyProgress(next);
      } catch {
        /* a dropped poll is harmless; the next one will catch up */
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      pollStartedAt.current = 0;
    };
  }, [phase, session, applyProgress]);

  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const validUrl = isDoushProfileUrl(profileUrl);
    setFieldError(validUrl ? null : t('import.profileInvalid'));
    setConsentError(consent ? null : t('import.consentRequired'));
    if (!validUrl || !consent) return;

    setBusy(true);
    try {
      const started = await startImport(profileUrl, consent);
      saveImportSession(started);
      setSession(started);
      setProgress(null);
      setPhase('code');
    } catch (requestError) {
      setError(importErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const next = await verifyImport(session.requestId);
      pollStartedAt.current = Date.now();
      applyProgress(next);
    } catch (requestError) {
      setError(importErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the code is selectable on screen; copying is only a convenience */
    }
  };

  const remaining = session ? Date.parse(session.expiresAt) - now : 0;
  const expired = phase === 'code' && session !== null && remaining <= 0;
  const attemptsLeft = progress?.attemptsLeft ?? session?.maxAttempts ?? 0;

  return (
    <div className="container page import-page">
      <h1>{t('import.title')}</h1>
      <p className="muted import-page__lead">{t('import.subtitle')}</p>

      {error ? (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      ) : null}

      {phase === 'form' ? (
        <>
          <section className="card card--pad" aria-labelledby="import-how">
            <h2 id="import-how" className="import-h2">
              {t('import.how.title')}
            </h2>
            <ol className="import-steps">
              <li>{t('import.how.step1')}</li>
              <li>{t('import.how.step2')}</li>
              <li>{t('import.how.step3')}</li>
              <li>{t('import.how.step4')}</li>
            </ol>
          </section>

          <form className="card card--pad stack" onSubmit={start} noValidate>
            <Field
              label={t('import.profileLabel')}
              htmlFor="import-profile"
              hint={t('import.profileHint')}
              error={fieldError}
              required>
              <Input
                id="import-profile"
                type="url"
                inputMode="url"
                dir="ltr"
                autoComplete="off"
                placeholder="https://doushesh.com/users/…"
                value={profileUrl}
                onChange={event => setProfileUrl(event.target.value)}
              />
            </Field>

            <div>
              <label className="import-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={event => setConsent(event.target.checked)}
                  aria-describedby={consentError ? 'import-consent-error' : undefined}
                />
                <span>{t('import.consent')}</span>
              </label>
              {consentError ? (
                <span id="import-consent-error" className="field__error" role="alert">
                  {consentError}
                </span>
              ) : null}
            </div>

            <Button type="submit" variant="primary" size="lg" block loading={busy}>
              {t('import.start')}
            </Button>
          </form>
        </>
      ) : null}

      {phase === 'code' && session ? (
        <section className="card card--pad stack" aria-labelledby="import-code-title">
          <h2 id="import-code-title" className="import-h2">
            {t('import.codeTitle')}
          </h2>
          <p>{t('import.codeHelp')}</p>

          <div className="import-code" dir="ltr">
            <code className="import-code__value" data-testid="import-code">
              {session.code}
            </code>
            <Button variant="secondary" size="sm" onClick={copyCode}>
              {copied ? t('import.copied') : t('import.copy')}
            </Button>
          </div>

          <p className="muted small" aria-live="polite">
            {expired
              ? t('import.expired')
              : t('import.remaining', {time: formatRemaining(remaining)})}
            {' · '}
            {t('import.attemptsLeft', {n: attemptsLeft})}
          </p>

          <div className="row-wrap">
            <Button
              variant="primary"
              size="lg"
              loading={busy}
              disabled={expired || attemptsLeft <= 0}
              onClick={verify}>
              {t('import.verify')}
            </Button>
            <Button variant="ghost" onClick={reset}>
              {t('import.startOver')}
            </Button>
          </div>
        </section>
      ) : null}

      {phase === 'working' ? (
        <section className="card card--pad stack" role="status" aria-live="polite">
          <div className="row-wrap">
            <span className="spinner spinner--dark" aria-hidden="true" />
            <strong>{t('import.working')}</strong>
          </div>
          <p className="muted">{t('import.workingHint')}</p>
        </section>
      ) : null}

      {phase === 'done' && progress ? (
        <section className="card card--pad stack import-done" aria-labelledby="import-done-title">
          <h2 id="import-done-title" className="import-h2">
            {t('import.doneTitle')}
          </h2>
          <ul className="import-results">
            <li>{t('import.importedCount', {count: progress.imported})}</li>
            {progress.skipped > 0 ? <li>{t('import.skippedCount', {count: progress.skipped})}</li> : null}
            {progress.duplicates > 0 ? (
              <li>{t('import.duplicateCount', {count: progress.duplicates})}</li>
            ) : null}
            {progress.phoneMasked ? (
              <li>
                {t('import.verifiedPhone')} <span dir="ltr">{progress.phoneMasked}</span>
              </li>
            ) : null}
          </ul>
          <p className="muted">{t('import.doneBody')}</p>
          <div className="row-wrap">
            <Link className="btn btn--primary" to="/">
              {t('import.browse')}
            </Link>
            <Button variant="ghost" onClick={reset}>
              {t('import.importAnother')}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="import-privacy" aria-labelledby="import-privacy-title">
        <h2 id="import-privacy-title" className="import-h2">
          {t('import.privacy.title')}
        </h2>
        <p className="muted">{t('import.privacy.body', {email: SUPPORT_EMAIL})}</p>
      </section>
    </div>
  );
};

export default ImportPage;
