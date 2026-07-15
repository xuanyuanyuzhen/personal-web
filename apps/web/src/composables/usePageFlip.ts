type PageFlipDirection = 'backward' | 'forward';

export const pageFlipDuration = 620;
const pageFlipCleanupDelay = 120;

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
let activePageFlipSession: number | null = null;
let pageFlipCleanup: (() => void) | undefined;
const routePageFlipSessions = new WeakMap<object, number>();

export function startRoutePageFlip(fromRoute: unknown, toRoute: unknown) {
  const fromIndex = resolvePageOrder(fromRoute);
  const toIndex = resolvePageOrder(toRoute);

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  stopPageFlip();

  if (fromIndex === null || toIndex === null || fromIndex === toIndex) {
    return null;
  }

  const direction = toIndex > fromIndex ? 'forward' : 'backward';
  const session = ++pageFlipSequence;

  activePageFlipSession = session;
  if (toRoute && typeof toRoute === 'object') {
    routePageFlipSessions.set(toRoute, session);
  }

  applyPageFlipVars(direction);

  return session;
}

export function armRoutePageFlipCleanup(session = activePageFlipSession, cleanup?: () => void) {
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    session === null ||
    session !== activePageFlipSession ||
    !document.documentElement.dataset.pageFlipDirection
  ) {
    return;
  }

  if (pageFlipTimer) {
    window.clearTimeout(pageFlipTimer);
  }

  pageFlipCleanup = cleanup;

  pageFlipTimer = window.setTimeout(() => {
    if (session === activePageFlipSession) {
      stopPageFlip(session);
    }
  }, pageFlipDuration + pageFlipCleanupDelay);
}

export function getRoutePageFlipSession(route: unknown) {
  if (!route || typeof route !== 'object') {
    return null;
  }

  return routePageFlipSessions.get(route) ?? null;
}

export function isRoutePageFlipActive(session: number | null) {
  return session !== null && session === activePageFlipSession;
}

function stopPageFlip(session?: number) {
  if (session !== undefined && session !== activePageFlipSession) {
    return;
  }

  if (pageFlipTimer) {
    window.clearTimeout(pageFlipTimer);
    pageFlipTimer = undefined;
  }

  const cleanup = pageFlipCleanup;

  pageFlipCleanup = undefined;
  activePageFlipSession = null;
  cleanup?.();

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
