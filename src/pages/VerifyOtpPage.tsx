import {useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useToast} from '@/components/ui/ToastProvider';
import {useAuth} from '@/lib/auth/AuthContext';
import {resendOtp, verifyOtp} from '@/lib/api/auth';
import {Button, Field, Input} from '@/components/ui';
import {errorMessage} from '@/lib/api/errorMessages';
import './auth.css';

/** Confirms the 4-digit code the backend emails after registration. */
const VerifyOtpPage = () => {
  const {t} = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const {show} = useToast();
  const {applySession} = useAuth();

  const email = (location.state as {email?: string} | null)?.email ?? '';
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useSeo({title: t('auth.otpTitle'), canonicalPath: '/verify', noIndex: true});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(otp)) {
      setError(t('auth.otpInvalid'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await verifyOtp(email, otp);
      if (!result.success) {
        setError(result.message || t('common.errorBody'));
        return;
      }
      // Some backend versions return a full session here; if so the user is
      // signed straight in, otherwise they continue to the login screen.
      if (result.session) {
        applySession(result.session);
        navigate('/', {replace: true});
      } else {
        show(t('auth.otpAction'), 'success');
        navigate('/login', {replace: true});
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    try {
      await resendOtp(email);
      show(t('auth.otpResent'), 'success');
    } catch (requestError) {
      show(errorMessage(requestError), 'error');
    }
  };

  return (
    <div className="container auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">{t('auth.otpTitle')}</h1>
        <p className="auth-card__subtitle">{t('auth.otpSubtitle', {email})}</p>

        <form className="auth-card__form" onSubmit={submit} noValidate>
          {error ? (
            <p className="auth-alert" role="alert">
              {error}
            </p>
          ) : null}

          <Field label={t('auth.otpLabel')} htmlFor="otp" error={error} required>
            <Input
              id="otp"
              className="otp-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={otp}
              onChange={event => setOtp(event.target.value.replace(/\D/g, ''))}
            />
          </Field>

          <Button type="submit" variant="primary" size="lg" block loading={submitting}>
            {t('auth.otpAction')}
          </Button>

          <Button type="button" variant="ghost" onClick={resend}>
            {t('auth.otpResend')}
          </Button>
        </form>

        <p className="auth-card__footer">
          <Link to="/login">{t('auth.loginAction')}</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyOtpPage;
