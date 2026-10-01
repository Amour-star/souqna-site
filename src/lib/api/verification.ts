import {api} from './client';

/**
 * Seller identity verification — the same three calls the mobile app makes
 * (`viewVerification`, `verification`, `updateVerfication`). The backend really
 * spells the update route "updateVerfication"; it is a contract, not a typo to fix here.
 */

/** Status values as the mobile client interprets them. */
export const VERIFICATION_STATUS = {
  /** Approved: the record is locked and the seller shows the verified badge. */
  APPROVED: 1,
  /** Submitted: the seller may still edit and resubmit. */
  SUBMITTED: 2,
} as const;

export const DOCUMENT_TYPES = ['cnic', 'drivingLicense'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const VERIFICATION_COUNTRIES = ['Syria', 'Turkey'] as const;
export type VerificationCountry = (typeof VERIFICATION_COUNTRIES)[number];

export type Gender = 'male' | 'female' | 'other';

export interface VerificationRecord {
  id: string;
  fullName?: string | null;
  dob?: string | null;
  gender?: Gender | null;
  country?: string | null;
  address?: string | null;
  idNumber?: string | null;
  issueDate?: string | null;
  expDate?: string | null;
  documentType?: string | null;
  idFrontSide?: string | null;
  idBackSide?: string | null;
  selfie?: string | null;
  status?: number | string | null;
}

export interface VerificationInput {
  fullName: string;
  dob: string;
  gender: Gender;
  country: string;
  address: string;
  documentType: string;
  idNumber: string;
  issueDate: string;
  expDate: string;
  phoneNo?: string;
  idFrontSide?: File | null;
  idBackSide?: File | null;
  selfie?: File | null;
}

/** Returns the seller's current record, or null when nothing was submitted yet. */
export const fetchVerification = async (): Promise<VerificationRecord | null> => {
  const {data} = await api.get('viewVerification');
  const record = data?.data;
  return record && typeof record === 'object' && !Array.isArray(record)
    ? (record as VerificationRecord)
    : null;
};

/**
 * Builds the multipart body. Like the mobile app, only fields that have a
 * value are sent, and images only when the seller picked a new one — so an
 * update never re-uploads (or wipes) a document that did not change.
 */
export const buildVerificationForm = (input: VerificationInput, existingId?: string): FormData => {
  const form = new FormData();
  const text: [string, string | undefined][] = [
    ['fullName', input.fullName],
    ['dob', input.dob],
    ['gender', input.gender],
    ['country', input.country],
    ['address', input.address],
    ['documentType', input.documentType],
    ['idNumber', input.idNumber],
    ['issueDate', input.issueDate],
    ['expDate', input.expDate],
    ['phoneNo', input.phoneNo],
  ];
  text.forEach(([key, value]) => {
    if (value?.trim()) form.append(key, value.trim());
  });
  if (input.idFrontSide) form.append('idFrontSide', input.idFrontSide, input.idFrontSide.name);
  if (input.idBackSide) form.append('idBackSide', input.idBackSide, input.idBackSide.name);
  if (input.selfie) form.append('selfie', input.selfie, input.selfie.name);
  if (existingId) form.append('id', existingId);
  return form;
};

export const submitVerification = async (
  input: VerificationInput,
  existingId?: string,
): Promise<{success: boolean; message?: string}> => {
  const {data} = await api.post(
    existingId ? 'updateVerfication' : 'verification',
    buildVerificationForm(input, existingId),
    {headers: {'Content-Type': 'multipart/form-data'}},
  );
  return {success: Boolean(data?.success), message: data?.message};
};
