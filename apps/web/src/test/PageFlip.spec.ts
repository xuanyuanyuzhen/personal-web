import { armRoutePageFlipCleanup, startRoutePageFlip } from '../composables/usePageFlip';

describe('route page flip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    delete document.documentElement.dataset.pageFlipDirection;
    document.documentElement.removeAttribute('style');
  });

  it('always uses one short animation regardless of route distance', () => {
    startRoutePageFlip({ name: 'home', path: '/' }, { name: 'about', path: '/about' });

    expect(document.documentElement.dataset.pageFlipDirection).toBe('forward');
    expect(document.documentElement.style.getPropertyValue('--page-flip-duration')).toBe('620ms');
    expect(document.documentElement.style.getPropertyValue('--page-flip-count')).toBe('');

    vi.advanceTimersByTime(5000);
    expect(document.documentElement.dataset.pageFlipDirection).toBe('forward');

    armRoutePageFlipCleanup();
    vi.advanceTimersByTime(1119);
    expect(document.documentElement.dataset.pageFlipDirection).toBe('forward');

    vi.advanceTimersByTime(1);
    expect(document.documentElement.dataset.pageFlipDirection).toBeUndefined();
  });

  it('sets the direction for a backward page turn', () => {
    startRoutePageFlip(
      { name: 'photos', path: '/photos' },
      { name: 'thoughts', path: '/thoughts' },
    );

    expect(document.documentElement.dataset.pageFlipDirection).toBe('backward');
    expect(document.documentElement.style.getPropertyValue('--page-flip-duration')).toBe('620ms');
  });

  it('lets the latest navigation take over the active animation', () => {
    startRoutePageFlip({ name: 'home', path: '/' }, { name: 'thoughts', path: '/thoughts' });
    armRoutePageFlipCleanup();
    vi.advanceTimersByTime(300);

    startRoutePageFlip({ name: 'thoughts', path: '/thoughts' }, { name: 'home', path: '/' });
    armRoutePageFlipCleanup();

    vi.advanceTimersByTime(819);
    expect(document.documentElement.dataset.pageFlipDirection).toBe('backward');

    vi.advanceTimersByTime(301);
    expect(document.documentElement.dataset.pageFlipDirection).toBeUndefined();
  });
});
