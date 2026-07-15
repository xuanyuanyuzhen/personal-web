const transitionClassPattern = /^page-(?:enter|leave)-(?:active|from|to)$/;
const snapshotClassNames = ['page-turn-front-snapshot', 'page-turn-crease'];

let snapshotElements: HTMLElement[] = [];
let snapshotOwner: number | null = null;

export function capturePageTurnSource(session: number) {
  clearPageTurnSnapshots();

  if (typeof document === 'undefined' || !document.documentElement.dataset.pageFlipDirection) {
    return;
  }

  const container = document.querySelector<HTMLElement>('.site-main');

  if (!container) {
    return;
  }

  const element = findRoutePageElement(container);

  if (!element) {
    return;
  }

  const frontSnapshot = createSnapshot(element, 'page-turn-front-snapshot');

  snapshotElements = [frontSnapshot];
  snapshotOwner = session;
  container.append(frontSnapshot);
}

export function capturePageTurnTarget(session: number) {
  if (
    typeof document === 'undefined' ||
    snapshotOwner !== session ||
    !document.documentElement.dataset.pageFlipDirection
  ) {
    return;
  }

  const container = document.querySelector<HTMLElement>('.site-main');

  if (!container) {
    return;
  }

  const crease = document.createElement('div');

  crease.className = 'page-turn-crease';
  crease.setAttribute('aria-hidden', 'true');

  snapshotElements.push(crease);
  container.append(crease);

  // Commit the source snapshot before starting the moving page and its crease together.
  void crease.offsetWidth;
  snapshotElements.forEach((snapshot) => snapshot.classList.add('page-turn-running'));
}

export function clearPageTurnSnapshots(session?: number) {
  if (session !== undefined && session !== snapshotOwner) {
    return;
  }

  snapshotElements.forEach((element) => element.remove());
  snapshotElements = [];
  snapshotOwner = null;
}

function findRoutePageElement(container: HTMLElement) {
  return Array.from(container.children).find(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      !snapshotClassNames.some((className) => element.classList.contains(className)),
  );
}

function createSnapshot(element: HTMLElement, className: string) {
  const snapshot = element.cloneNode(true) as HTMLElement;
  const paperOffset = element.parentElement?.offsetTop ?? 0;

  Array.from(snapshot.classList).forEach((name) => {
    if (transitionClassPattern.test(name)) {
      snapshot.classList.remove(name);
    }
  });

  snapshot.classList.add(className);
  snapshot.style.setProperty('--page-turn-paper-offset-y', `${-paperOffset}px`);
  snapshot.setAttribute('aria-hidden', 'true');
  snapshot.inert = true;
  snapshot.querySelectorAll('[id]').forEach((child) => child.removeAttribute('id'));
  snapshot.removeAttribute('id');

  return snapshot;
}
