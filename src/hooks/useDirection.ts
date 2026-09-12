import {useTranslation} from 'react-i18next';
import {directionFor} from '@/lib/i18n';

/**
 * The active writing direction.
 *
 * Layout is handled entirely by logical CSS properties; this hook is for the
 * few places where JavaScript or glyph choice has to know the direction —
 * chiefly the image carousel, where horizontal scrolling is not symmetric.
 */
export const useDirection = () => {
  const {i18n} = useTranslation();
  const direction = directionFor(i18n.language);
  return {direction, isRtl: direction === 'rtl'};
};
