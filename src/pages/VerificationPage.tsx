import {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useSeo} from '@/hooks/useSeo';
import {useAuth} from '@/lib/auth/AuthContext';
import {useToast} from '@/components/ui/ToastProvider';
import {
  DOCUMENT_TYPES,
  VERIFICATION_COUNTRIES,
  VERIFICATION_STATUS,
  fetchVerification,
  submitVerification,
  type Gender,
  type VerificationInput,
} from '@/lib/api/verification';
import {errorMessage} from '@/lib/api/errorMessages';
import {mediaUrl} from '@/lib/format';
import {prepareImageForUpload, validateImageFile} from '@/lib/images';
import {Badge, Button, ErrorState, Field, Input, LoadingState, Select} from '@/components/ui';
import './verification.css';

type ImageSlot = 'idFrontSide' | 'idBackSide' | 'selfie';

interface Picked {
  file: File;
  previewUrl: string;
}

const EMPTY_FORM = {
  fullName: '',
  dob: '',
  gender: 'male' as Gender,
  country: 'Syria',
  address: '',
  documentType: 'cnic',
  idNumber: '',
  issueDate: '',
  expDate: '',
  phoneNo: '',
};

type FormState = typeof EMPTY_FORM;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Seller identity verification. Documents are sent straight to the API and are
 * never written to browser storage — this is identity data, so unlike the
 * listing form there is deliberately no draft persistence.
 */
const VerificationPage = () => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {isSeller, user} = useAuth();
  const {show} = useToast();

  useSeo({title: t('verification.title'), canonicalPath: '/profile/verification', noIndex: true});

  const record = useQuery({queryKey: ['verification'], queryFn: fetchVerification});

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [picked, setPicked] = useState<Partial<Record<ImageSlot, Picked>>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | ImageSlot, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const pickedRef = useRef(picked);
  pickedRef.current = picked;

  const existing = record.data;
  const approved = Number(existing?.status) === VERIFICATION_STATUS.APPROVED;
  const submitted = Number(existing?.status) === VERIFICATION_STATUS.SUBMITTED;
  const locked = approved;

  // Fill the form once from the saved record.
  useEffect(() => {
    if (hydrated || record.isLoading) return;
    if (existing) {
      setForm({
        fullName: existing.fullName ?? '',
        dob: existing.dob ?? '',
        gender: (existing.gender as Gender) || 'male',
        country: existing.country || 'Syria',
        address: existing.address ?? '',
        documentType: existing.documentType || 'cnic',
        idNumber: existing.idNumber ?? '',
        issueDate: existing.issueDate ?? '',
        expDate: existing.expDate ?? '',
        phoneNo: user?.phone ?? '',
      });
    } else {
      setForm(current => ({...current, phoneNo: user?.phone ?? ''}));
    }
    setHydrated(true);
  }, [existing, hydrated, record.isLoading, user?.phone]);

  // Release object URLs when the page goes away.
  useEffect(
    () => () => {
      Object.values(pickedRef.current).forEach(item => item && URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(current => ({...current, [key]: value}));
    setErrors(current => ({...current, [key]: undefined}));
  };

  const pickImage = async (slot: ImageSlot, file: File | undefined) => {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setErrors(current => ({
        ...current,
        [slot]: t(problem.code === 'size' ? 'verification.imageTooLarge' : 'verification.imageInvalid'),
      }));
      return;
    }
    const prepared = await prepareImageForUpload(file);
    setPicked(current => {
      const previous = current[slot];
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return {...current, [slot]: {file: prepared, previewUrl: URL.createObjectURL(prepared)}};
    });
    setErrors(current => ({...current, [slot]: undefined}));
  };

  const clearImage = (slot: ImageSlot) =>
    setPicked(current => {
      const previous = current[slot];
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      const next = {...current};
      delete next[slot];
      return next;
    });

  const validate = () => {
    const next: typeof errors = {};
    const required = t('verification.required');
    if (!form.fullName.trim()) next.fullName = required;
    if (!form.dob) next.dob = required;
    else if (form.dob > today()) next.dob = t('verification.dateInFuture');
    if (!form.address.trim()) next.address = required;
    if (!form.idNumber.trim()) next.idNumber = required;
    if (!form.issueDate) next.issueDate = required;
    if (!form.expDate) next.expDate = required;
    else if (form.expDate < today()) next.expDate = t('verification.expired');
    // Images are required the first time; on an update the saved ones are kept.
    if (!picked.idFrontSide && !existing?.idFrontSide) next.idFrontSide = required;
    if (!picked.idBackSide && !existing?.idBackSide) next.idBackSide = required;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (locked || !validate()) return;
    setSubmitting(true);
    try {
      const input: VerificationInput = {
        ...form,
        idFrontSide: picked.idFrontSide?.file,
        idBackSide: picked.idBackSide?.file,
        selfie: picked.selfie?.file,
      };
      const result = await submitVerification(input, existing?.id);
      if (!result.success) {
        show(result.message || t('verification.failed'), 'error');
        return;
      }
      await queryClient.invalidateQueries({queryKey: ['verification']});
      show(t(existing ? 'verification.updated' : 'verification.submittedToast'), 'success');
      navigate('/profile');
    } catch (error) {
      show(errorMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSeller) {
    return (
      <div className="container page verification">
        <h1>{t('verification.title')}</h1>
        <p className="muted">{t('verification.sellersOnly')}</p>
        <Link to="/profile/settings">{t('verification.switchToSeller')}</Link>
      </div>
    );
  }

  if (record.isLoading) return <LoadingState label={t('common.loading')} />;
  if (record.isError) {
    return (
      <div className="container page">
        <ErrorState onRetry={() => void record.refetch()} />
      </div>
    );
  }

  const imageField = (slot: ImageSlot, label: string, capture?: 'user' | 'environment') => {
    const preview = picked[slot]?.previewUrl ?? mediaUrl(existing?.[slot]);
    const id = `verification-${slot}`;
    return (
      <Field label={label} htmlFor={id} error={errors[slot]} required={slot !== 'selfie'} optional={slot === 'selfie'}>
        <div className="verification__upload">
          {preview ? <img src={preview} alt={label} className="verification__preview" /> : null}
          {!locked ? (
            <div className="row-wrap">
              <label className="btn btn--secondary" htmlFor={id}>
                {preview ? t('verification.replaceImage') : t('verification.chooseImage')}
              </label>
              {picked[slot] ? (
                <Button variant="ghost" onClick={() => clearImage(slot)}>
                  {t('verification.removeImage')}
                </Button>
              ) : null}
            </div>
          ) : null}
          <input
            id={id}
            className="sr-only"
            type="file"
            accept="image/*"
            capture={capture}
            disabled={locked}
            onChange={event => {
              void pickImage(slot, event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>
      </Field>
    );
  };

  return (
    <div className="container page verification">
      <h1>{t('verification.title')}</h1>
      <p className="muted">{t('verification.intro')}</p>

      {approved ? (
        <p className="verification__status verification__status--ok" role="status">
          <Badge tone="success">{t('verification.approvedBadge')}</Badge> {t('verification.approvedText')}
        </p>
      ) : submitted ? (
        <p className="verification__status" role="status">
          <Badge tone="warning">{t('verification.submittedBadge')}</Badge> {t('verification.submittedText')}
        </p>
      ) : null}

      <form className="card card--pad stack" onSubmit={onSubmit} noValidate>
        <Field label={t('verification.fullName')} htmlFor="v-fullName" error={errors.fullName} required>
          <Input
            id="v-fullName"
            value={form.fullName}
            autoComplete="name"
            disabled={locked}
            aria-invalid={Boolean(errors.fullName)}
            onChange={event => update('fullName', event.target.value)}
          />
        </Field>

        <div className="verification__row">
          <Field label={t('verification.dob')} htmlFor="v-dob" error={errors.dob} required>
            <Input
              id="v-dob"
              type="date"
              max={today()}
              value={form.dob}
              disabled={locked}
              aria-invalid={Boolean(errors.dob)}
              onChange={event => update('dob', event.target.value)}
            />
          </Field>
          <Field label={t('verification.gender')} htmlFor="v-gender">
            <Select
              id="v-gender"
              value={form.gender}
              disabled={locked}
              onChange={event => update('gender', event.target.value as Gender)}>
              <option value="male">{t('verification.male')}</option>
              <option value="female">{t('verification.female')}</option>
              <option value="other">{t('verification.other')}</option>
            </Select>
          </Field>
        </div>

        <div className="verification__row">
          <Field label={t('verification.country')} htmlFor="v-country">
            <Select
              id="v-country"
              value={form.country}
              disabled={locked}
              onChange={event => update('country', event.target.value)}>
              {VERIFICATION_COUNTRIES.map(country => (
                <option key={country} value={country}>
                  {t(`verification.country_${country}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('verification.phone')} htmlFor="v-phone" optional>
            <Input
              id="v-phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
              value={form.phoneNo}
              disabled={locked}
              onChange={event => update('phoneNo', event.target.value)}
            />
          </Field>
        </div>

        <Field label={t('verification.address')} htmlFor="v-address" error={errors.address} required>
          <Input
            id="v-address"
            value={form.address}
            autoComplete="street-address"
            disabled={locked}
            aria-invalid={Boolean(errors.address)}
            onChange={event => update('address', event.target.value)}
          />
        </Field>

        <div className="verification__row">
          <Field label={t('verification.documentType')} htmlFor="v-doctype">
            <Select
              id="v-doctype"
              value={form.documentType}
              disabled={locked}
              onChange={event => update('documentType', event.target.value)}>
              {DOCUMENT_TYPES.map(type => (
                <option key={type} value={type}>
                  {t(`verification.doc_${type}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('verification.idNumber')} htmlFor="v-idnumber" error={errors.idNumber} required>
            <Input
              id="v-idnumber"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              value={form.idNumber}
              disabled={locked}
              aria-invalid={Boolean(errors.idNumber)}
              onChange={event => update('idNumber', event.target.value)}
            />
          </Field>
        </div>

        <div className="verification__row">
          <Field label={t('verification.issueDate')} htmlFor="v-issue" error={errors.issueDate} required>
            <Input
              id="v-issue"
              type="date"
              max={today()}
              value={form.issueDate}
              disabled={locked}
              aria-invalid={Boolean(errors.issueDate)}
              onChange={event => update('issueDate', event.target.value)}
            />
          </Field>
          <Field label={t('verification.expDate')} htmlFor="v-exp" error={errors.expDate} required>
            <Input
              id="v-exp"
              type="date"
              min={today()}
              value={form.expDate}
              disabled={locked}
              aria-invalid={Boolean(errors.expDate)}
              onChange={event => update('expDate', event.target.value)}
            />
          </Field>
        </div>

        <div className="verification__row">
          {imageField('idFrontSide', t('verification.idFront'), 'environment')}
          {imageField('idBackSide', t('verification.idBack'), 'environment')}
        </div>
        {imageField('selfie', t('verification.selfie'), 'user')}

        <p className="field__hint">{t('verification.privacy')}</p>

        {!locked ? (
          <Button type="submit" variant="primary" size="lg" loading={submitting}>
            {existing ? t('verification.update') : t('verification.submit')}
          </Button>
        ) : null}
      </form>
    </div>
  );
};

export default VerificationPage;
