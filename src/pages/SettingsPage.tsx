import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useSeo} from '@/hooks/useSeo';
import {useAuth} from '@/lib/auth/AuthContext';
import {useToast} from '@/components/ui/ToastProvider';
import {changePassword, deleteAccount, updateProfile} from '@/lib/api/auth';
import {errorMessage} from '@/lib/api/errorMessages';
import {SUPPORTED_LANGUAGES, changeLanguage} from '@/lib/i18n';
import {Button, Field, Input, Modal, Select} from '@/components/ui';
import {PasswordInput} from '@/components/ui/PasswordInput';
import './profile.css';

const MIN_PASSWORD = 6;

/** Account settings: profile, password, language, account type and deletion. */
const SettingsPage = () => {
  const {t, i18n} = useTranslation();
  const navigate = useNavigate();
  const {user, updateUser, isSeller, becomeBuyer, logout} = useAuth();
  const {show} = useToast();

  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({current: '', next: '', confirm: ''});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useSeo({title: t('nav.settings'), canonicalPath: '/profile/settings', noIndex: true});

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile(profile);
      updateUser({name: profile.name, email: profile.email, phone: profile.phone});
      show(t('profile.saved'), 'success');
    } catch (error) {
      show(errorMessage(error), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);

    if (passwords.next.length < MIN_PASSWORD) {
      setPasswordError(t('auth.passwordTooShort', {count: MIN_PASSWORD}));
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError(t('auth.passwordsDontMatch'));
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({current: '', next: '', confirm: ''});
      show(t('profile.passwordChanged'), 'success');
    } catch (error) {
      setPasswordError(errorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      await logout();
      navigate('/', {replace: true});
    } catch (error) {
      show(errorMessage(error), 'error');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="container page" style={{maxWidth: 720}}>
      <h1>{t('nav.settings')}</h1>

      <section className="card card--pad settings-section" aria-labelledby="settings-profile">
        <h2 id="settings-profile">{t('profile.personalInfo')}</h2>
        <form className="stack" onSubmit={saveProfile}>
          <Field label={t('profile.name')} htmlFor="settings-name" required>
            <Input
              id="settings-name"
              value={profile.name}
              autoComplete="name"
              onChange={event => setProfile(current => ({...current, name: event.target.value}))}
            />
          </Field>

          <Field label={t('profile.email')} htmlFor="settings-email" required>
            <Input
              id="settings-email"
              type="email"
              value={profile.email}
              autoComplete="email"
              onChange={event => setProfile(current => ({...current, email: event.target.value}))}
            />
          </Field>

          <Field label={t('profile.phone')} htmlFor="settings-phone" optional>
            <Input
              id="settings-phone"
              type="tel"
              value={profile.phone ?? ''}
              autoComplete="tel"
              onChange={event => setProfile(current => ({...current, phone: event.target.value}))}
            />
          </Field>

          <Button type="submit" variant="primary" loading={savingProfile}>
            {t('profile.save')}
          </Button>
        </form>
      </section>

      <section className="card card--pad settings-section" aria-labelledby="settings-security">
        <h2 id="settings-security">{t('profile.changePassword')}</h2>
        <form className="stack" onSubmit={savePassword}>
          {passwordError ? (
            <p className="auth-alert" role="alert">
              {passwordError}
            </p>
          ) : null}

          <Field label={t('profile.currentPassword')} htmlFor="password-current" required>
            <PasswordInput
              id="password-current"
              autoComplete="current-password"
              value={passwords.current}
              onChange={event =>
                setPasswords(current => ({...current, current: event.target.value}))
              }
            />
          </Field>

          <Field label={t('profile.newPassword')} htmlFor="password-next" required>
            <PasswordInput
              id="password-next"
              autoComplete="new-password"
              value={passwords.next}
              onChange={event => setPasswords(current => ({...current, next: event.target.value}))}
            />
          </Field>

          <Field label={t('profile.confirmPassword')} htmlFor="password-confirm" required>
            <PasswordInput
              id="password-confirm"
              autoComplete="new-password"
              value={passwords.confirm}
              onChange={event =>
                setPasswords(current => ({...current, confirm: event.target.value}))
              }
            />
          </Field>

          <Button type="submit" variant="primary" loading={savingPassword}>
            {t('profile.changePassword')}
          </Button>
        </form>
      </section>

      <section className="card card--pad settings-section" aria-labelledby="settings-language">
        <h2 id="settings-language">{t('profile.language')}</h2>
        <Field label={t('profile.language')} htmlFor="settings-language-select">
          <Select
            id="settings-language-select"
            value={i18n.language}
            onChange={event => void changeLanguage(event.target.value)}>
            {SUPPORTED_LANGUAGES.map(language => (
              <option key={language.code} value={language.code}>
                {language.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="card card--pad settings-section" aria-labelledby="settings-account">
        <h2 id="settings-account">{t('profile.accountType')}</h2>
        <p className="muted">
          {isSeller ? t('profile.sellerAccount') : t('profile.buyerAccount')}
        </p>
        {isSeller ? (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await becomeBuyer();
                show(t('profile.saved'), 'success');
              } catch (error) {
                show(errorMessage(error), 'error');
              }
            }}>
            {t('profile.switchToBuying')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate('/sell')}>
            {t('profile.switchToSelling')}
          </Button>
        )}
      </section>

      <section
        className="card card--pad settings-section settings-danger"
        aria-labelledby="settings-delete">
        <h2 id="settings-delete">{t('profile.dangerZone')}</h2>
        <p className="muted">{t('profile.deleteAccountBody')}</p>
        <Button variant="danger" onClick={() => setDeleteOpen(true)}>
          {t('profile.deleteAccount')}
        </Button>
      </section>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('profile.deleteAccount')}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              {t('profile.deleteConfirm')}
            </Button>
          </>
        }>
        <p className="muted">{t('profile.deleteAccountBody')}</p>
      </Modal>
    </div>
  );
};

export default SettingsPage;
