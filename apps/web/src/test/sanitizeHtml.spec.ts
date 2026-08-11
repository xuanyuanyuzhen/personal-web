import { sanitizeRichHtml } from '../utils/sanitizeHtml';

describe('sanitizeRichHtml', () => {
  it('keeps supported rich text while removing executable content', () => {
    const result = sanitizeRichHtml(`
      <div>
        <p onclick="alert(1)">Safe <strong>content</strong></p>
        <script>alert('unsafe')</script>
        <iframe src="https://example.com"></iframe>
      </div>
    `);

    expect(result).toContain('<p>Safe <strong>content</strong></p>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('script');
    expect(result).not.toContain('iframe');
  });

  it('blocks dangerous links and image sources', () => {
    const result = sanitizeRichHtml(`
      <a href="javascript:alert(1)" target="_blank">Bad link</a>
      <a href="https://example.com" target="_blank">Good link</a>
      <img src="data:image/svg+xml;base64,PHN2Zz4=" onerror="alert(1)" alt="Bad image">
    `);

    expect(result).toContain('<a>Bad link</a>');
    expect(result).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Good link</a>',
    );
    expect(result).toContain('<img alt="Bad image">');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('onerror');
  });
});
