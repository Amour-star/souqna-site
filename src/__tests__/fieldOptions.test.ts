import {describe, expect, it} from 'vitest';
import {fieldOptions, optionLabel} from '@/lib/fieldOptions';

const jsonField = {
  options: JSON.stringify({ar: 'أوتوماتيك, يدوي', en: 'Automatic, Manual'}),
  ar_options: null,
};

describe('fieldOptions', () => {
  it('shows Arabic labels but stores the canonical English value', () => {
    expect(fieldOptions(jsonField, 'ar')).toEqual([
      {label: 'أوتوماتيك', value: 'Automatic'},
      {label: 'يدوي', value: 'Manual'},
    ]);
  });

  it('shows English labels in English', () => {
    expect(fieldOptions(jsonField, 'en')).toEqual([
      {label: 'Automatic', value: 'Automatic'},
      {label: 'Manual', value: 'Manual'},
    ]);
  });

  it('stores the same value regardless of UI language', () => {
    const values = (language: string) => fieldOptions(jsonField, language).map(option => option.value);
    expect(values('ar')).toEqual(values('en'));
  });

  it('reads the legacy comma-separated format', () => {
    const field = {options: 'Petrol, Diesel', ar_options: null};
    expect(fieldOptions(field, 'ar')).toEqual([
      {label: 'Petrol', value: 'Petrol'},
      {label: 'Diesel', value: 'Diesel'},
    ]);
  });

  it('pairs a legacy ar_options column by index when lengths match', () => {
    const field = {options: 'Petrol,Diesel', ar_options: 'بنزين,ديزل'};
    expect(fieldOptions(field, 'ar')).toEqual([
      {label: 'بنزين', value: 'Petrol'},
      {label: 'ديزل', value: 'Diesel'},
    ]);
  });

  it('ignores a mismatched ar_options column rather than mis-pairing', () => {
    const field = {options: 'Petrol,Diesel,Hybrid', ar_options: 'بنزين,ديزل'};
    expect(fieldOptions(field, 'ar').map(option => option.label)).toEqual(['Petrol', 'Diesel', 'Hybrid']);
  });

  it('returns nothing for empty or missing options', () => {
    expect(fieldOptions({options: null, ar_options: null}, 'ar')).toEqual([]);
    expect(fieldOptions({options: '', ar_options: null}, 'ar')).toEqual([]);
  });

  it('labels a stored value, and passes unknown values through', () => {
    const options = fieldOptions(jsonField, 'ar');
    expect(optionLabel(options, 'Manual')).toBe('يدوي');
    expect(optionLabel(options, 'Unknown')).toBe('Unknown');
  });
});
