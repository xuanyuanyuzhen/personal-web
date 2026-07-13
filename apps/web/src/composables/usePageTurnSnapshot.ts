const transitionClassPattern = /^page-(?:enter|leave)-(?:active|from|to)$/;

let snapshotElements: HTMLElement[] = [];
let snapshotOwner: Element | null = null;

export function capturePageTurnTarget(element: Element) {
  clearPageTurnSnapshots();

  if (
    typeof document === 'undefined' ||
    !(element instanceof HTMLElement) ||
    !document.documentElement.dataset.pageFlipDirection
  ) {
    return;
  }

  const container = document.querySelector<HTMLElement>('.site-main');

  if (!container) {
    return;
  }

  const targetSnapshot = createSnapshot(element, 'page-turn-target-snapshot');
  const backSnapshot = createSnapshot(element, 'page-turn-back-snapshot');
  const crease = document.createElement('div');

  crease.className = 'page-turn-crease';
  crease.setAttribute('aria-hidden', 'true');

  snapshotElements = [targetSnapshot, backSnapshot, crease];
  snapshotOwner = element;
  container.append(...snapshotElements);
}

export function clearPageTurnSnapshots(element?: Element) {
  if (element && element !== snapshotOwner) {
    return;
  }

  snapshotElements.forEach((element) => element.remove());
  snapshotElements = [];
  snapshotOwner = null;
}

function createSnapshot(element: HTMLElement, className: string) {
  const snapshot = element.cloneNode(true) as HTMLElement;

  Array.from(snapshot.classList).forEach((name) => {
    if (transitionClassPattern.test(name)) {
      snapshot.classList.remove(name);
    }
  });

  snapshot.classList.add(className);
  snapshot.setAttribute('aria-hidden', 'true');
  snapshot.inert = true;
  snapshot.querySelectorAll('[id]').forEach((child) => child.removeAttribute('id'));
  snapshot.removeAttribute('id');

  return snapshot;
}
