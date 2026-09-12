import {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {forgotPassword} from '@/lib/api/auth';
import {Button, Field, Input} from '@/components/ui';
import {errorMessage} from '@/lib/api/errorMessages';
import './auth.css';

const ForgotPasswordPage = () => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useSeo({title: t('auth.forgotTitle'), canonicalPath: '/forgot-password', noIndex: true});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(email);
      navigate('/reset-password', {state: {email: email.trim().toLowerCase()}});
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">{t('auth.forgotTitle')}</h1>
        <p className="auth-card__subtitle">{t('auth.forgotSubtitle')}</p>

        <form className="auth-card__form" onSubmit={submit} noValidate>
          {error ? (
            <p className="auth-alert" role="alert">
              {error}
            </p>
          ) : null}

          <Field label={t('auth.email')} htmlFor="forgot-email" required>
            <Input
              id="forgot-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </Field>

          <Button type="submit" variant="primary" size="lg" block loading={submitting}>
            {t('auth.forgotAction')}
          </Button>
        </form>

        <p className="auth-card__footer">
          <Link to="/login">{t('auth.loginAction')}</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
