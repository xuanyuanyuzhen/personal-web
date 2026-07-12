type PageFlipDirection = 'backward' | 'forward';

const pageFlipDuration = 1100;

const pageOrder: Record<string, number> = {
  home: 0,
  thoughts: 1,
  essays: 2,
  'essay-detail': 2,
  photos: 3,
  messages: 4,
  about: 5,
};

const pagePathOrder: Array<[RegExp, number]> = [
  [/^\/$/, pageOrder.home],
  [/^\/thoughts\/?$/, pageOrder.thoughts],
  [/^\/essays(?:\/.*)?$/, pageOrder.essays],
  [/^\/photos\/?$/, pageOrder.photos],
  [/^\/messages\/?$/, pageOrder.messages],
  [/^\/about\/?$/, pageOrder.about],
];

let pageFlipOverlay: HTMLElement | null = null;
let pageFlipTimer: number | undefined;

export function startRoutePageFlip(fromRoute: unknown, toRoute: unknown) {
  const fromIndex = resolvePageOrder(fromRoute);
  const toIndex = resolvePageOrder(toRoute);

  if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
    return;
  }

  const direction = toIndex > fromIndex ? 'forward' : 'backward';

  stopPageFlip();

  if (typeof document === 'undefined') {
    return;
  }

  const source = document.querySelector<HTMLElement>('.route-page');

  if (!source) {
    return;
  }

  const overlay = createPageFlipOverlay(source, direction);

  document.body.append(overlay);
  document.documentElement.dataset.pageFlipDirection = direction;
  document.documentElement.style.setProperty('--page-flip-duration', `${pageFlipDuration}ms`);
  pageFlipOverlay = overlay;

  overlay.addEventListener('animationend', (event) => {
    if (event.target === overlay) {
      stopPageFlip();
    }
  });
  pageFlipTimer = window.setTimeout(stopPageFlip, pageFlipDuration + 1000);
}

export function finishRoutePageFlip() {
  if (!pageFlipOverlay || typeof document === 'undefined') {
    return;
  }

  const target = document.querySelector<HTMLElement>('.route-page');
  const back = pageFlipOverlay.querySelector<HTMLElement>('.book-flip-back');

  if (!target || !back) {
    stopPageFlip();
    return;
  }

  back.replaceChildren(createPageCopy(target, 'book-flip-back-copy', pageFlipOverlay));
  pageFlipOverlay.getBoundingClientRect();
  pageFlipOverlay.classList.add('is-ready');

  if (pageFlipTimer) {
    window.clearTimeout(pageFlipTimer);
  }
  pageFlipTimer = window.setTimeout(stopPageFlip, pageFlipDuration + 160);
}

function stopPageFlip() {
  if (pageFlipTimer) {
    window.clearTimeout(pageFlipTimer);
    pageFlipTimer = undefined;
  }

  if (typeof document === 'undefined') {
    return;
  }

  pageFlipOverlay?.remove();
  pageFlipOverlay = null;
  delete document.documentElement.dataset.pageFlipDirection;
  document.documentElement.style.removeProperty('--page-flip-duration');
}

function createPageFlipOverlay(source: HTMLElement, direction: PageFlipDirection) {
  const sourceRect = source.getBoundingClientRect();
  const headerBottom =
    document.querySelector<HTMLElement>('.site-header')?.getBoundingClientRect().bottom ?? 0;
  const overlayTop = Math.max(0, headerBottom);
  const overlayHeight = Math.max(1, window.innerHeight - overlayTop);
  const isMobile = window.matchMedia?.('(max-width: 720px)').matches ?? false;
  const overlay = document.createElement('div');

  overlay.className = `book-flip-overlay is-${direction}${isMobile ? ' is-mobile' : ''}`;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('inert', '');
  overlay.style.left = `${sourceRect.left}px`;
  overlay.style.top = `${overlayTop}px`;
  overlay.style.width = `${sourceRect.width}px`;
  overlay.style.height = `${overlayHeight}px`;
  overlay.style.setProperty('--book-copy-width', `${sourceRect.width}px`);

  const staticHalf = document.createElement('div');
  const underShadow = document.createElement('div');
  const sheet = document.createElement('div');
  const front = document.createElement('div');
  const back = document.createElement('div');
  const spine = document.createElement('div');

  staticHalf.className = 'book-flip-static';
  underShadow.className = 'book-flip-under-shadow';
  sheet.className = 'book-flip-sheet';
  front.className = 'book-flip-face book-flip-front';
  back.className = 'book-flip-face book-flip-back';
  spine.className = 'book-flip-spine';

  staticHalf.append(createPageCopy(source, 'book-flip-static-copy', overlay));
  front.append(createPageCopy(source, 'book-flip-front-copy', overlay));
  sheet.append(front, back);
  overlay.append(staticHalf, underShadow, sheet, spine);

  return overlay;
}

function createPageCopy(source: HTMLElement, className: string, overlay: HTMLElement) {
  const sourceRect = source.getBoundingClientRect();
  const overlayTop = overlay.isConnected
    ? overlay.getBoundingClientRect().top
    : Number.parseFloat(overlay.style.top) || 0;
  const copy = source.cloneNode(true) as HTMLElement;

  copy.className = `${copy.className} book-flip-copy ${className}`;
  copy.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  copy.querySelectorAll('[autofocus]').forEach((element) => element.removeAttribute('autofocus'));
  copy.style.width = 'var(--book-copy-width)';
  copy.style.top = `${sourceRect.top - overlayTop}px`;
  copy.style.setProperty('--book-paper-x', `${-(window.scrollX + sourceRect.left)}px`);
  copy.style.setProperty('--book-paper-y', `${-(window.scrollY + sourceRect.top)}px`);

  return copy;
}

function resolvePageOrder(name: unknown): number | null {
  const routeName = typeof name === 'string' ? name : readRouteString(name, 'name');

  if (Object.prototype.hasOwnProperty.call(pageOrder, routeName)) {
    return pageOrder[routeName];
  }

  const routePath = readRouteString(name, 'path');
  const pathMatch = pagePathOrder.find(([pattern]) => pattern.test(routePath));

  return pathMatch?.[1] ?? null;
}

function readRouteString(route: unknown, key: 'name' | 'path') {
  if (!route || typeof route !== 'object' || !(key in route)) {
    return '';
  }

  const value = (route as Record<'name' | 'path', unknown>)[key];

  return typeof value === 'string' ? value : '';
}
