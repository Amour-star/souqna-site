import {describe, expect, it} from 'vitest';
import {buildVerificationForm, type VerificationInput} from '@/lib/api/verification';

const base: VerificationInput = {
  fullName: '  Ahmad Test  ',
  dob: '1990-05-01',
  gender: 'male',
  country: 'Syria',
  address: 'Aleppo',
  documentType: 'cnic',
  idNumber: '01234 5678901 2',
  issueDate: '2020-01-01',
  expDate: '2030-01-01',
};

const image = (name: string) => new File(['x'], name, {type: 'image/jpeg'});

describe('buildVerificationForm', () => {
  it('sends trimmed text fields under the names the API expects', () => {
    const form = buildVerificationForm(base);
    expect(form.get('fullName')).toBe('Ahmad Test');
    expect(form.get('documentType')).toBe('cnic');
    expect(form.get('idNumber')).toBe('01234 5678901 2');
    expect(form.get('expDate')).toBe('2030-01-01');
  });

  it('omits empty fields instead of sending blanks', () => {
    const form = buildVerificationForm({...base, address: '   ', phoneNo: ''});
    expect(form.has('address')).toBe(false);
    expect(form.has('phoneNo')).toBe(false);
  });

  it('attaches only the images that were picked', () => {
    const form = buildVerificationForm({...base, idFrontSide: image('front.jpg')});
    expect((form.get('idFrontSide') as File).name).toBe('front.jpg');
    expect(form.has('idBackSide')).toBe(false);
    expect(form.has('selfie')).toBe(false);
  });

  it('marks an update with the existing record id', () => {
    expect(buildVerificationForm(base, 'rec-1').get('id')).toBe('rec-1');
    expect(buildVerificationForm(base).has('id')).toBe(false);
  });
});
