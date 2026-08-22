// 一次性验证:在 reduced-motion 环境下(复刻用户 Windows 关闭动画效果的真实浏览器),
// 首页 hover 微交互的 transition 是否真的恢复了时长,而不是被全局规则压成 0.001ms。
import { chromium } from '@playwright/test';

const browser = await chromium
  .launch({ channel: process.env.PW_CHANNEL || 'chrome' })
  .catch(() => chromium.launch({ channel: 'msedge' }));
const context = await browser.newContext({ reducedMotion: 'reduce' });
const page = await context.newPage();

await page.route('**/api/**', (route) => {
  const url = route.request().url();
  if (url.includes('/essays/public')) {
    return route.fulfill({
      json: {
        items: [
          {
            category: null,
            categoryId: null,
            content: '<p>x</p>',
            coverUrl: null,
            createdAt: '2026-08-01T00:00:00.000Z',
            id: 1,
            isPinned: false,
            likeCount: 0,
            liked: false,
            publishedAt: '2026-08-01T00:00:00.000Z',
            slug: 'a',
            summary: 's',
            tags: [],
            title: 't',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
        pagination: { page: 1, pageSize: 1, total: 1 },
      },
    });
  }
  if (url.includes('/likes/status')) {
    return route.fulfill({ json: { likeCount: 1, liked: false } });
  }
  return route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 1, total: 0 } } });
});

await page.goto('http://localhost:5173/');
await page.keyboard.press('Enter');
await page
  .locator('.boot-terminal')
  .click({ force: true, timeout: 3000 })
  .catch(() => undefined);
await page.locator('.boot-terminal').waitFor({ state: 'detached', timeout: 15000 });
await page.waitForSelector('.home-latest-link');

const report = await page.evaluate(() => {
  const read = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return `${selector}: NOT FOUND`;
    const style = getComputedStyle(el);
    return `${selector}: duration=${style.transitionDuration} property=${style.transitionProperty}`;
  };

  return [
    read('.home-latest-link'),
    read('.heart-like-button'),
    `prefers-reduced-motion=${matchMedia('(prefers-reduced-motion: reduce)').matches}`,
  ].join('\n');
});

console.log(report);
await browser.close();
