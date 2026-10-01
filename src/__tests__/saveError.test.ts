import {describe, expect, it} from 'vitest';
import {classifySaveError} from '@/lib/api/saveError';
import {STEP} from '@/lib/listingForm';

const http = (status: number, data: unknown = {}) => ({isAxiosError: true, response: {status, data}});

describe('classifySaveError', () => {
  it('maps 422 field errors to fields and the earliest step that holds one', () => {
    const failure = classifySaveError(
      http(422, {errors: {price: ['The price field is required.'], 'images.0': ['must be an image'], city_id: ['bad']}}),
    );
    expect(failure.kind).toBe('validation');
    expect(failure.fields.map(f => f.field)).toEqual(['price', 'images', 'location']);
    expect(failure.step).toBe(STEP.PHOTOS);
  });

  it('treats HTTP 200 {success:false, errors} like a validation failure', () => {
    expect(classifySaveError(http(200, {errors: {name: ['x']}})).kind).toBe('validation');
  });

  it('classifies auth, size, server and network failures', () => {
    expect(classifySaveError(http(401)).kind).toBe('unauthenticated');
    expect(classifySaveError(http(403)).kind).toBe('forbidden');
    expect(classifySaveError(http(413)).kind).toBe('tooLarge');
    expect(classifySaveError(http(500)).kind).toBe('server');
    expect(classifySaveError(http(502)).kind).toBe('server');
    // CORS-less 5xx surfaces in the browser as an axios error with no response.
    expect(classifySaveError({isAxiosError: true}).kind).toBe('network');
  });

  it('falls back to unknown for anything else', () => {
    expect(classifySaveError(new Error('boom')).kind).toBe('unknown');
  });
});
