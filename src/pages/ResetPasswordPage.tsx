import {useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useToast} from '@/components/ui/ToastProvider';
import {resetPassword, verifyOtp} from '@/lib/api/auth';
import {Button, Field, Input} from '@/components/ui';
import {PasswordInput} from '@/components/ui/PasswordInput';
import {errorMessage} from '@/lib/api/errorMessages';
import './auth.css';

const MIN_PASSWORD = 6;

/**
 * Second half of the reset flow: confirm the emailed code, then set a new
 * password with the token the verification step returns.
 */
const ResetPasswordPage = () => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {show} = useToast();

  const email = (location.state as {email?: string} | null)?.email ?? '';
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useSeo({title: t('auth.resetTitle'), canonicalPath: '/reset-password', noIndex: true});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(otp)) {
      setError(t('auth.otpInvalid'));
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(t('auth.passwordTooShort', {count: MIN_PASSWORD}));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordsDontMatch'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const verification = await verifyOtp(email, otp, true);
      if (!verification.success || !verification.token) {
        setError(verification.message || t('auth.otpInvalid'));
        return;
      }

      await resetPassword({
        password,
        confirmationPassword: confirm,
        token: verification.token,
      });

      show(t('auth.resetSuccess'), 'success');
      navigate('/login', {replace: true});
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">{t('auth.resetTitle')}</h1>
        <p className="auth-card__subtitle">{t('auth.otpSubtitle', {email})}</p>

        <form className="auth-card__form" onSubmit={submit} noValidate>
          {error ? (
            <p className="auth-alert" role="alert">
              {error}
            </p>
          ) : null}

          <Field label={t('auth.otpLabel')} htmlFor="reset-otp" required>
            <Input
              id="reset-otp"
              className="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={otp}
              onChange={event => setOtp(event.target.value.replace(/\D/g, ''))}
            />
          </Field>

          <Field label={t('auth.password')} htmlFor="reset-password" required>
            <PasswordInput
              id="reset-password"
              autoComplete="new-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </Field>

          <Field label={t('auth.confirmPassword')} htmlFor="reset-confirm" required>
            <PasswordInput
              id="reset-confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
            />
          </Field>

          <Button type="submit" variant="primary" size="lg" block loading={submitting}>
            {t('auth.resetAction')}
          </Button>
        </form>

        <p className="auth-card__footer">
          <Link to="/login">{t('auth.loginAction')}</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
