import { capturePageTurnTarget, clearPageTurnSnapshots } from '../composables/usePageTurnSnapshot';

describe('page turn snapshots', () => {
  afterEach(() => {
    clearPageTurnSnapshots();
    delete document.documentElement.dataset.pageFlipDirection;
    document.body.innerHTML = '';
  });

  it('freezes the target content for the page turn layers', () => {
    document.documentElement.dataset.pageFlipDirection = 'forward';
    document.body.innerHTML = `
      <main class="site-main">
        <section id="target-page" class="page-enter-active essays-view">
          <button id="target-action">Target content</button>
        </section>
      </main>
    `;

    const target = document.querySelector('#target-page');

    expect(target).not.toBeNull();
    capturePageTurnTarget(target!);

    const targetSnapshot = document.querySelector('.page-turn-target-snapshot');
    const backSnapshot = document.querySelector('.page-turn-back-snapshot');

    expect(targetSnapshot?.textContent).toContain('Target content');
    expect(backSnapshot?.textContent).toContain('Target content');
    expect(targetSnapshot?.getAttribute('aria-hidden')).toBe('true');
    expect(targetSnapshot?.querySelector('[id]')).toBeNull();
    expect(document.querySelector('.page-turn-crease')).not.toBeNull();
  });

  it('does not create snapshots outside an explicit page turn', () => {
    document.body.innerHTML = '<main class="site-main"><section>Target</section></main>';

    capturePageTurnTarget(document.querySelector('section')!);

    expect(document.querySelector('.page-turn-target-snapshot')).toBeNull();
  });

  it('does not let a cancelled old transition clear the latest snapshots', () => {
    document.documentElement.dataset.pageFlipDirection = 'forward';
    document.body.innerHTML = `
      <main class="site-main">
        <section id="old-target">Old target</section>
        <section id="latest-target">Latest target</section>
      </main>
    `;

    const oldTarget = document.querySelector('#old-target')!;
    const latestTarget = document.querySelector('#latest-target')!;

    capturePageTurnTarget(oldTarget);
    capturePageTurnTarget(latestTarget);
    clearPageTurnSnapshots(oldTarget);

    expect(document.querySelector('.page-turn-target-snapshot')?.textContent).toContain(
      'Latest target',
    );
  });
});
