import {
  capturePageTurnSource,
  capturePageTurnTarget,
  clearPageTurnSnapshots,
} from '../composables/usePageTurnSnapshot';

describe('page turn snapshots', () => {
  afterEach(() => {
    clearPageTurnSnapshots();
    delete document.documentElement.dataset.pageFlipDirection;
    document.body.innerHTML = '';
  });

  it('freezes only the source page while the live target remains visible', () => {
    document.documentElement.dataset.pageFlipDirection = 'forward';
    document.body.innerHTML = `
      <main class="site-main">
        <section id="route-page" class="essays-view">
          <button id="route-action">Current content</button>
        </section>
      </main>
    `;

    capturePageTurnSource(1);
    document.querySelector('#route-action')!.textContent = 'Target content';
    capturePageTurnTarget(1);

    const frontSnapshot = document.querySelector('.page-turn-front-snapshot');

    const targetSnapshot = document.querySelector('.page-turn-target-snapshot');

    expect(frontSnapshot?.textContent).toContain('Current content');
    expect(document.querySelector('#route-action')?.textContent).toContain('Target content');
    expect(targetSnapshot).toBeNull();
    expect(document.querySelector('.page-turn-back-snapshot')).toBeNull();
    expect(frontSnapshot?.getAttribute('aria-hidden')).toBe('true');
    expect(frontSnapshot?.querySelector('[id]')).toBeNull();
    expect(document.querySelector('.page-turn-crease')).not.toBeNull();
  });

  it('does not create snapshots outside an explicit page turn', () => {
    document.body.innerHTML = '<main class="site-main"><section>Target</section></main>';

    capturePageTurnSource(1);

    expect(document.querySelector('.page-turn-target-snapshot')).toBeNull();
    expect(document.querySelector('.page-turn-front-snapshot')).toBeNull();
  });

  it('does not let a cancelled old transition clear the latest snapshots', () => {
    document.documentElement.dataset.pageFlipDirection = 'forward';
    document.body.innerHTML = `
      <main class="site-main">
        <section id="route-page">Old target</section>
      </main>
    `;

    capturePageTurnSource(1);

    document.querySelector('#route-page')!.textContent = 'Latest target';
    capturePageTurnSource(2);
    capturePageTurnTarget(2);
    clearPageTurnSnapshots(1);

    expect(document.querySelector('.page-turn-front-snapshot')?.textContent).toContain(
      'Latest target',
    );
  });
});
