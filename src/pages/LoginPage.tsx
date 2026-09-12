import {useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '@/lib/auth/AuthContext';
import {useSeo} from '@/hooks/useSeo';
import {useToast} from '@/components/ui/ToastProvider';
import {Button, Field, Input} from '@/components/ui';
import {PasswordInput} from '@/components/ui/PasswordInput';
import {errorMessage} from '@/lib/api/errorMessages';
import './auth.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginPage = () => {
  const {t} = useTranslation();
  const {login} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {show} = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{email?: string; password?: string}>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as {from?: string} | null)?.from ?? '/';

  useSeo({
    title: t('auth.loginTitle'),
    description: t('auth.loginSubtitle'),
    canonicalPath: '/login',
    noIndex: true,
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = t('auth.emailInvalid');
    if (password.length < 3) nextErrors.password = t('auth.passwordTooShort', {count: 3});
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const user = await login(email, password);
      show(t('auth.welcomeBack', {name: user.name || user.email}), 'success');
      navigate(redirectTo, {replace: true});
    } catch (error) {
      setFormError(errorMessage(error, 'auth.invalidCredentials'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">{t('auth.loginTitle')}</h1>
        <p className="auth-card__subtitle">{t('auth.loginSubtitle')}</p>

        <form className="auth-card__form" onSubmit={submit} noValidate>
          {formError ? (
            <p className="auth-alert" role="alert">
              {formError}
            </p>
          ) : null}

          <Field label={t('auth.email')} htmlFor="login-email" error={errors.email} required>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              aria-invalid={Boolean(errors.email)}
              onChange={event => setEmail(event.target.value)}
            />
          </Field>

          <Field
            label={t('auth.password')}
            htmlFor="login-password"
            error={errors.password}
            required>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              value={password}
              aria-invalid={Boolean(errors.password)}
              onChange={event => setPassword(event.target.value)}
            />
          </Field>

          <div className="row">
            <Link to="/forgot-password">{t('auth.forgotPassword')}</Link>
          </div>

          <Button type="submit" variant="primary" size="lg" block loading={submitting}>
            {submitting ? t('auth.loggingIn') : t('auth.loginAction')}
          </Button>
        </form>

        <p className="auth-card__footer">
          {t('auth.noAccount')} <Link to="/register">{t('auth.registerAction')}</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
