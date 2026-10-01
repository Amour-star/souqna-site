/** Cards in the first row(s) of a grid are above the fold: load them eagerly and at high priority (LCP). */
export const ABOVE_THE_FOLD_CARDS = 4;

export const imageLoadingProps = (index: number): {loading: 'eager' | 'lazy'; fetchPriority?: 'high'} =>
  index < ABOVE_THE_FOLD_CARDS ? {loading: 'eager', fetchPriority: 'high'} : {loading: 'lazy'};
