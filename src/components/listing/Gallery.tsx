import {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {mediaUrl} from '@/lib/format';
import {useDirection} from '@/hooks/useDirection';
import type {ProductImage} from '@/types';

/**
 * Listing gallery: keyboard-navigable thumbnails on desktop, swipeable strip
 * on touch, and a full-screen viewer. Images that fail to load fall back to a
 * placeholder instead of collapsing the layout.
 */
export const Gallery = ({images, title}: {images: ProductImage[]; title: string}) => {
  const {t} = useTranslation();
  const {isRtl} = useDirection();
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const trackRef = useRef<HTMLDivElement>(null);

  const count = images.length;
  const current = images[index];
  const currentUrl = current ? mediaUrl(current.path) : null;

  /**
   * Scrolls the strip to a slide.
   *
   * Absolute `scrollLeft` is not portable here: it counts up from zero in LTR
   * and down from zero in RTL. `scrollIntoView` is no better — it also walks
   * ancestor scrollers and silently did nothing inside this container. So the
   * distance is measured on screen and applied as a relative scroll, which
   * means the same code in Arabic and English.
   */
  const scrollToSlide = useCallback((target: number) => {
    const track = trackRef.current;
    const slide = track?.children?.[target] as HTMLElement | undefined;
    if (!track || !slide) return;

    const delta = slide.getBoundingClientRect().left - track.getBoundingClientRect().left;
    if (Math.abs(delta) < 1) return;
    track.scrollBy({left: delta, behavior: 'smooth'});
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (!count) return;
      setIndex(previous => {
        const next = (previous + delta + count) % count;
        scrollToSlide(next);
        return next;
      });
    },
    [count, scrollToSlide],
  );

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
      if (event.key === 'ArrowRight') go(isRtl ? -1 : 1);
      if (event.key === 'ArrowLeft') go(isRtl ? 1 : -1);
    };
    document.addEventListener('keydown', onKey);
    const {overflow} = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [fullscreen, go, isRtl]);

  // Track which image the touch strip has scrolled to, for the counter.
  // `scrollLeft` is negative in RTL, so the magnitude is what matters.
  const onTrackScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const next = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
    setIndex(Math.min(Math.max(next, 0), Math.max(count - 1, 0)));
  };

  if (!count) {
    return (
      <div className="gallery">
        <div className="gallery__main gallery__main--empty">
          <span>{t('listing.noImage')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery">
      <div className="gallery__main">
        <div
          className="gallery__track"
          ref={trackRef}
          onScroll={onTrackScroll}
          role="group"
          aria-label={title}>
          {images.map((image, imageIndex) => {
            const url = mediaUrl(image.path);
            return (
              <div className="gallery__slide" key={image.id}>
                {url && !failed[image.id] ? (
                  <img
                    src={url}
                    alt={`${title} — ${imageIndex + 1}`}
                    loading={imageIndex === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    onClick={() => {
                      setIndex(imageIndex);
                      setFullscreen(true);
                    }}
                    onError={() => setFailed(state => ({...state, [image.id]: true}))}
                  />
                ) : (
                  <span className="gallery__placeholder">{t('listing.noImage')}</span>
                )}
              </div>
            );
          })}
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              className="gallery__nav gallery__nav--prev"
              onClick={() => go(-1)}
              aria-label={t('listing.previousImage')}>
              {/* The button sits on the leading edge, so the glyph points the
                  same way the reader moves backwards: left in LTR, right in RTL. */}
              {isRtl ? '›' : '‹'}
            </button>
            <button
              type="button"
              className="gallery__nav gallery__nav--next"
              onClick={() => go(1)}
              aria-label={t('listing.nextImage')}>
              {isRtl ? '‹' : '›'}
            </button>
            <span className="gallery__counter" aria-live="polite">
              {t('listing.imageCount', {current: index + 1, total: count})}
            </span>
          </>
        ) : null}

        <button
          type="button"
          className="gallery__expand"
          onClick={() => setFullscreen(true)}
          aria-label={t('listing.openGallery')}>
          ⤢
        </button>
      </div>

      {count > 1 ? (
        <div className="gallery__thumbs" role="tablist" aria-label={title}>
          {images.map((image, imageIndex) => {
            const url = mediaUrl(image.path);
            return (
              <button
                key={image.id}
                type="button"
                role="tab"
                aria-selected={imageIndex === index}
                className={`gallery__thumb${imageIndex === index ? ' gallery__thumb--active' : ''}`}
                onClick={() => {
                  setIndex(imageIndex);
                  scrollToSlide(imageIndex);
                }}>
                {url && !failed[image.id] ? (
                  <img src={url} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden="true">🖼️</span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {fullscreen ? (
        <div
          className="gallery__fullscreen"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setFullscreen(false)}>
          <button
            type="button"
            className="gallery__close"
            onClick={() => setFullscreen(false)}
            aria-label={t('listing.closeGallery')}>
            ✕
          </button>
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={`${title} — ${index + 1}`}
              onClick={event => event.stopPropagation()}
            />
          ) : null}
          {count > 1 ? (
            <>
              <button
                type="button"
                className="gallery__nav gallery__nav--prev"
                onClick={event => {
                  event.stopPropagation();
                  go(-1);
                }}
                aria-label={t('listing.previousImage')}>
                {isRtl ? '›' : '‹'}
              </button>
              <button
                type="button"
                className="gallery__nav gallery__nav--next"
                onClick={event => {
                  event.stopPropagation();
                  go(1);
                }}
                aria-label={t('listing.nextImage')}>
                {isRtl ? '‹' : '›'}
              </button>
              <span className="gallery__counter">
                {t('listing.imageCount', {current: index + 1, total: count})}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
