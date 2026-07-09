const VISITOR_ID_KEY = 'yuer.visitorId';

function createVisitorId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `visitor_${crypto.randomUUID()}`;
  }

  return `visitor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getVisitorId(): string {
  if (typeof window === 'undefined') {
    return createVisitorId();
  }

  const storedVisitorId = window.localStorage.getItem(VISITOR_ID_KEY);
  if (storedVisitorId) {
    return storedVisitorId;
  }

  const nextVisitorId = createVisitorId();
  window.localStorage.setItem(VISITOR_ID_KEY, nextVisitorId);
  return nextVisitorId;
}

export function readVisitorId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(VISITOR_ID_KEY);
}
