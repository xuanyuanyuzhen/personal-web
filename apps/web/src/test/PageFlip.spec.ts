import { finishRoutePageFlip, startRoutePageFlip } from '../composables/usePageFlip';

describe('route page flip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <header class="site-header"></header>
      <main class="site-main">
        <div class="route-page"><h1>Current page</h1></div>
      </main>
    `;

    vi.stubGlobal(
      'matchMedia',
      vi.fn(
        (query: string) =>
          ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
          }) as MediaQueryList,
      ),
    );
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('uses the current page on the front and the target page on the back', () => {
    startRoutePageFlip({ name: 'home', path: '/' }, { name: 'thoughts', path: '/thoughts' });

    const overlay = document.querySelector('.book-flip-overlay');

    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains('is-forward')).toBe(true);
    expect(overlay?.classList.contains('is-ready')).toBe(false);
    expect(overlay?.querySelector('.book-flip-front-copy')?.textContent).toContain('Current page');

    document.querySelector('.route-page')!.innerHTML = '<h1>Target page</h1>';
    finishRoutePageFlip();

    expect(overlay?.classList.contains('is-ready')).toBe(true);
    expect(overlay?.querySelector('.book-flip-back-copy')?.textContent).toContain('Target page');
    expect(overlay?.querySelector('.book-flip-back-copy')?.textContent).not.toContain(
      'Current page',
    );
    expect(document.documentElement.style.getPropertyValue('--page-flip-duration')).toBe('1100ms');

    vi.advanceTimersByTime(1260);

    expect(document.querySelector('.book-flip-overlay')).toBeNull();
  });

  it('places the target half correctly when turning backward', () => {
    startRoutePageFlip(
      { name: 'photos', path: '/photos' },
      { name: 'thoughts', path: '/thoughts' },
    );
    document.querySelector('.route-page')!.innerHTML = '<h1>Previous page</h1>';
    finishRoutePageFlip();

    const overlay = document.querySelector('.book-flip-overlay');

    expect(overlay?.classList.contains('is-backward')).toBe(true);
    expect(overlay?.querySelector('.book-flip-back-copy')?.textContent).toContain('Previous page');
  });
});
