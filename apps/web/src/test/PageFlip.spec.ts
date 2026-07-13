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

  it('uses the current page on the front and a frozen target page on the back', async () => {
    startRoutePageFlip({ name: 'home', path: '/' }, { name: 'thoughts', path: '/thoughts' });

    const overlay = document.querySelector('.book-flip-overlay');

    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains('is-forward')).toBe(true);
    expect(overlay?.classList.contains('is-ready')).toBe(false);
    expect(overlay?.querySelector('.book-flip-front-copy')?.textContent).toContain('Current page');

    document.querySelector('.route-page')!.innerHTML = '<h1>Target page</h1>';
    await finishRoutePageFlip({ waitForContent: false });

    expect(overlay?.classList.contains('is-ready')).toBe(true);
    expect(overlay?.querySelector('.book-flip-back-copy')?.textContent).toContain('Target page');
    expect(overlay?.querySelector('.book-flip-back-copy')?.textContent).not.toContain(
      'Current page',
    );
    expect(overlay?.querySelector('.book-flip-target-copy')?.textContent).toContain('Target page');

    document.querySelector('.route-page')!.innerHTML = '<h1>Changed after snapshot</h1>';

    expect(overlay?.querySelector('.book-flip-target-copy')?.textContent).not.toContain(
      'Changed after snapshot',
    );
    expect(document.documentElement.style.getPropertyValue('--page-flip-duration')).toBe('820ms');

    vi.advanceTimersByTime(1260);

    expect(document.querySelector('.book-flip-overlay')).toBeNull();
  });

  it('places the target half correctly when turning backward', async () => {
    startRoutePageFlip(
      { name: 'photos', path: '/photos' },
      { name: 'thoughts', path: '/thoughts' },
    );
    document.querySelector('.route-page')!.innerHTML = '<h1>Previous page</h1>';
    await finishRoutePageFlip({ waitForContent: false });

    const overlay = document.querySelector('.book-flip-overlay');

    expect(overlay?.classList.contains('is-backward')).toBe(true);
    expect(overlay?.querySelector('.book-flip-back-copy')?.textContent).toContain('Previous page');
  });

  it('waits for target content to finish loading before taking the snapshot', async () => {
    startRoutePageFlip({ name: 'home', path: '/' }, { name: 'thoughts', path: '/thoughts' });
    document.querySelector('.route-page')!.innerHTML =
      '<section aria-busy="true"><h1>Loading page</h1></section>';

    const finishPromise = finishRoutePageFlip();

    await vi.advanceTimersByTimeAsync(240);
    expect(document.querySelector('.book-flip-overlay')?.classList.contains('is-ready')).toBe(
      false,
    );

    const target = document.querySelector('.route-page section')!;
    target.setAttribute('aria-busy', 'false');
    target.innerHTML = '<h1>Loaded page</h1>';
    await vi.advanceTimersByTimeAsync(140);
    await finishPromise;

    expect(document.querySelector('.book-flip-target-copy')?.textContent).toContain('Loaded page');
  });
});
