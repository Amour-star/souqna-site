import {describe, expect, it} from 'vitest';
import {ABOVE_THE_FOLD_CARDS, imageLoadingProps} from '@/lib/imageLoading';

describe('listing thumbnails (P3 LCP)', () => {
  it('loads the first row eagerly with high priority and the rest lazily', () => {
    for (let i = 0; i < ABOVE_THE_FOLD_CARDS; i++) {
      expect(imageLoadingProps(i)).toEqual({loading: 'eager', fetchPriority: 'high'});
    }
    expect(imageLoadingProps(ABOVE_THE_FOLD_CARDS)).toEqual({loading: 'lazy'});
    expect(imageLoadingProps(Number.MAX_SAFE_INTEGER)).toEqual({loading: 'lazy'});
  });
});
