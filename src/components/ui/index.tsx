import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import {useTranslation} from 'react-i18next';
import './ui.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({variant = 'secondary', size = 'md', block, loading, children, className, disabled, ...rest}, ref) => (
    <button
      ref={ref}
      type="button"
      className={[
        'btn',
        `btn--${variant}`,
        size !== 'md' ? `btn--${size}` : '',
        block ? 'btn--block' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  /** Marks the field as mandatory with an asterisk. Form inputs only. */
  required?: boolean;
  /** Labels the field as optional. Use on form inputs the user may skip. */
  optional?: boolean;
  children: ReactNode;
}

/**
 * Label + hint + error wrapper that keeps form semantics consistent.
 *
 * Neither flag is implied: a control that is neither required nor optional
 * (a search filter, say) gets a plain label with no annotation.
 */
export const Field = ({
  label,
  htmlFor,
  hint,
  error,
  required,
  optional,
  children,
}: FieldProps) => {
  const {t} = useTranslation();
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <span style={{color: 'var(--danger)'}} aria-hidden="true">
            {' *'}
          </span>
        ) : null}
        {optional ? <span className="muted small"> ({t('common.optional')})</span> : null}
      </label>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
};

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({className, ...rest}, ref) => (
    <input ref={ref} className={`input ${className ?? ''}`} {...rest} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({className, ...rest}, ref) => (
  <textarea ref={ref} className={`textarea ${className ?? ''}`} {...rest} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({className, children, ...rest}, ref) => (
  <select ref={ref} className={`select ${className ?? ''}`} {...rest}>
    {children}
  </select>
));
Select.displayName = 'Select';

export const Badge = ({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'brand' | 'success' | 'danger' | 'warning';
}) => (
  <span className={`badge${tone === 'default' ? '' : ` badge--${tone}`}`}>{children}</span>
);

export const Skeleton = ({
  height = 16,
  width = '100%',
  radius,
  className,
}: {
  height?: number | string;
  width?: number | string;
  radius?: number | string;
  className?: string;
}) => (
  <span
    className={`skeleton ${className ?? ''}`}
    style={{
      display: 'block',
      height: typeof height === 'number' ? `${height}px` : height,
      width: typeof width === 'number' ? `${width}px` : width,
      borderRadius: radius,
    }}
    aria-hidden="true"
  />
);

export const EmptyState = ({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) => (
  <div className="state">
    {icon ? (
      <span className="state__icon" aria-hidden="true">
        {icon}
      </span>
    ) : null}
    <h2 className="state__title">{title}</h2>
    {body ? <p className="state__body">{body}</p> : null}
    {action}
  </div>
);

/** Error state with a retry affordance — never leave the user at a blank page. */
export const ErrorState = ({
  title,
  body,
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) => {
  const {t} = useTranslation();
  return (
    <div className="state" role="alert">
      <span className="state__icon" aria-hidden="true">
        ⚠️
      </span>
      <h2 className="state__title">{title ?? t('common.errorTitle')}</h2>
      <p className="state__body">{body ?? t('common.errorBody')}</p>
      {onRetry ? (
        <Button variant="primary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
};

export const LoadingState = ({label}: {label?: string}) => {
  const {t} = useTranslation();
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" />
      <p className="state__body">{label ?? t('common.loading')}</p>
    </div>
  );
};

/**
 * Accessible modal: focus moves in on open, Escape closes, and focus returns
 * to the trigger on close.
 */
export const Modal = ({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const {t} = useTranslation();

  useEffect(() => {
    if (!open) return undefined;

    previousFocus.current = document.activeElement as HTMLElement;
    const {overflow} = document.body.style;
    document.body.style.overflow = 'hidden';

    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const items = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(item => !item.hasAttribute('disabled'));
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previousFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}>
        <div className="row" style={{alignItems: 'flex-start'}}>
          <h2 className="modal__title" style={{flex: 1}}>
            {title}
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        {children}
        {actions ? <div className="modal__actions">{actions}</div> : null}
      </div>
    </div>
  );
};
