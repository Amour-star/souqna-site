import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {renderInlineMarkdown} from '@/lib/inlineMarkdown';

describe('renderInlineMarkdown', () => {
  it('turns **bold** into <strong> and never leaves raw asterisks', () => {
    const html = renderToStaticMarkup(<>{renderInlineMarkdown('المدينة: **حلب** و **دمشق** **')}</>);
    expect(html).toContain('<strong>حلب</strong>');
    expect(html).not.toContain('*');
  });

  it('escapes HTML instead of injecting it', () => {
    const html = renderToStaticMarkup(<>{renderInlineMarkdown('<img src=x onerror=alert(1)>')}</>);
    expect(html).not.toContain('<img');
  });
});
