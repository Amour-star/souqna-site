import {useState, type InputHTMLAttributes} from 'react';
import {useTranslation} from 'react-i18next';

/** Password field with an accessible show/hide toggle. */
export const PasswordInput = (props: InputHTMLAttributes<HTMLInputElement>) => {
  const {t} = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-field">
      <input
        {...props}
        className={`input ${props.className ?? ''}`}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        className="password-field__toggle"
        onClick={() => setVisible(current => !current)}
        aria-pressed={visible}>
        {visible ? t('auth.hidePassword') : t('auth.showPassword')}
      </button>
    </span>
  );
};
