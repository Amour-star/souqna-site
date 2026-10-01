import {Fragment, type ReactNode} from 'react';

/**
 * Renders the `**bold**` markers that admin broadcasts contain as <strong>,
 * and drops any stray markers. Only React text nodes are produced — nothing is
 * injected as HTML, so there is no XSS surface.
 */
export const renderInlineMarkdown = (text: string): ReactNode =>
  text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      /^\*\*[^*]+\*\*$/.test(part) ? (
        <strong key={index}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={index}>{part.replace(/\*\*/g, '')}</Fragment>
      ),
    );
