type PageFlipDirection = 'backward' | 'forward';

const pageFlipDuration = 620;
const pageFlipCleanupDelay = 500;

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

let pageFlipTimer: number | undefined;
let pageFlipSequence = 0;

export function startRoutePageFlip(fromRoute: unknown, toRoute: unknown) {
  const fromIndex = resolvePageOrder(fromRoute);
  const toIndex = resolvePageOrder(toRoute);

  if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
    return;
  }

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }

  stopPageFlip();

  const direction = toIndex > fromIndex ? 'forward' : 'backward';

  applyPageFlipVars(direction);
}

export function armRoutePageFlipCleanup() {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    !document.documentElement.dataset.pageFlipDirection
  ) {
    return;
  }

  if (pageFlipTimer) {
    window.clearTimeout(pageFlipTimer);
  }

  const sequence = pageFlipSequence;

  pageFlipTimer = window.setTimeout(() => {
    if (sequence === pageFlipSequence) {
      stopPageFlip();
    }
  }, pageFlipDuration + pageFlipCleanupDelay);
}

function stopPageFlip() {
  pageFlipSequence += 1;

  if (pageFlipTimer) {
    window.clearTimeout(pageFlipTimer);
    pageFlipTimer = undefined;
  }

  if (typeof document === 'undefined') {
    return;
  }

  delete document.documentElement.dataset.pageFlipDirection;
  document.documentElement.style.removeProperty('--page-flip-duration');
}

function applyPageFlipVars(direction: PageFlipDirection) {
  document.documentElement.dataset.pageFlipDirection = direction;
  document.documentElement.style.setProperty('--page-flip-duration', `${pageFlipDuration}ms`);
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
