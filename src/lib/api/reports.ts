import {api} from './client';
import {FEATURES, SUPPORT_EMAIL} from '@/lib/config';
import type {ID} from '@/types';

export const REPORT_REASONS = ['spam', 'prohibited', 'fraud', 'offensive', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const SUBMITTED_KEY = 'souqna.reportedListings';

/** Listings this browser has already reported, to stop accidental re-sends. */
const readSubmitted = (): string[] => {
  try {
    const raw = window.localStorage.getItem(SUBMITTED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const hasReported = (productID: ID) => readSubmitted().includes(String(productID));

const markReported = (productID: ID) => {
  try {
    const next = [...new Set([...readSubmitted(), String(productID)])].slice(-50);
    window.localStorage.setItem(SUBMITTED_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
};

export interface ReportInput {
  productID: ID;
  reason: ReportReason;
  details?: string;
  listingUrl: string;
}

/**
 * Submits a listing report.
 *
 * When the API endpoint is deployed the report is recorded server-side, where
 * it can be rate limited and moderated. Until then the only channel available
 * is the user's own email client — which is why the dialog says so plainly
 * rather than implying the report was filed.
 */
export const submitReport = async (
  input: ReportInput,
): Promise<'submitted' | 'email'> => {
  if (FEATURES.reportsApi) {
    const {data} = await api.post('reports', {
      productID: input.productID,
      reason: input.reason,
      details: input.details || null,
    });
    if (!data?.success) throw new Error(data?.message || 'Report failed');
    markReported(input.productID);
    return 'submitted';
  }

  const subject = encodeURIComponent(`Report listing ${input.productID}`);
  const body = encodeURIComponent(
    [
      `Listing: ${input.listingUrl}`,
      `Reason: ${input.reason}`,
      input.details ? `Details: ${input.details}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  markReported(input.productID);
  return 'email';
};
