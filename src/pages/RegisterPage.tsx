import {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useAuth} from '@/lib/auth/AuthContext';
import {useSeo} from '@/hooks/useSeo';
import {Button, Field, Input} from '@/components/ui';
import {PasswordInput} from '@/components/ui/PasswordInput';
import {errorMessage} from '@/lib/api/errorMessages';
import './auth.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

const RegisterPage = () => {
  const {t} = useTranslation();
  const {register} = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({name: '', email: '', password: '', confirm: ''});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useSeo({
    title: t('auth.registerTitle'),
    description: t('auth.registerSubtitle'),
    canonicalPath: '/register',
    noIndex: true,
  });

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm(current => ({...current, [key]: event.target.value}));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = t('auth.nameRequired');
    if (!EMAIL_PATTERN.test(form.email.trim())) nextErrors.email = t('auth.emailInvalid');
    // The API accepts 3 characters; the web client asks for a stronger minimum.
    if (form.password.length < MIN_PASSWORD) {
      nextErrors.password = t('auth.passwordTooShort', {count: MIN_PASSWORD});
    }
    if (form.password !== form.confirm) {
      nextErrors.confirm = t('auth.passwordsDontMatch');
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const result = await register({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      navigate('/verify', {state: {email: result.email}, replace: true});
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">{t('auth.registerTitle')}</h1>
        <p className="auth-card__subtitle">{t('auth.registerSubtitle')}</p>

        <form className="auth-card__form" onSubmit={submit} noValidate>
          {formError ? (
            <p className="auth-alert" role="alert">
              {formError}
            </p>
          ) : null}

          <Field label={t('auth.name')} htmlFor="register-name" error={errors.name} required>
            <Input
              id="register-name"
              autoComplete="name"
              value={form.name}
              aria-invalid={Boolean(errors.name)}
              onChange={update('name')}
            />
          </Field>

          <Field label={t('auth.email')} htmlFor="register-email" error={errors.email} required>
            <Input
              id="register-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              aria-invalid={Boolean(errors.email)}
              onChange={update('email')}
            />
          </Field>

          <Field
            label={t('auth.password')}
            htmlFor="register-password"
            error={errors.password}
            required>
            <PasswordInput
              id="register-password"
              autoComplete="new-password"
              value={form.password}
              aria-invalid={Boolean(errors.password)}
              onChange={update('password')}
            />
          </Field>

          <Field
            label={t('auth.confirmPassword')}
            htmlFor="register-confirm"
            error={errors.confirm}
            required>
            <PasswordInput
              id="register-confirm"
              autoComplete="new-password"
              value={form.confirm}
              aria-invalid={Boolean(errors.confirm)}
              onChange={update('confirm')}
            />
          </Field>

          <p className="muted small">{t('auth.termsNotice')}</p>

          <Button type="submit" variant="primary" size="lg" block loading={submitting}>
            {submitting ? t('auth.registering') : t('auth.registerAction')}
          </Button>
        </form>

        <p className="auth-card__footer">
          {t('auth.hasAccount')} <Link to="/login">{t('auth.loginAction')}</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
