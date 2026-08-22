import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('yuer.locale', 'en');
  });
  await mockPublicShell(page);
});

test('visitor message with forbidden text enters audit state', async ({ page }) => {
  await page.route('**/api/messages/public?**', async (route) => {
    await route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 12, total: 0 } } });
  });
  await page.route('**/api/messages', async (route) => {
    await route.fulfill({
      json: {
        auditStatus: 'PENDING',
        avatarUrl: null,
        content: '这里有广告',
        createdAt: '2026-06-06T00:00:00.000Z',
        id: 2,
        nickname: 'Visitor',
        updatedAt: '2026-06-06T00:00:00.000Z',
      },
    });
  });

  await page.goto('/messages');
  await page.locator('input[autocomplete="name"]').fill('Visitor');
  await page.locator('input[autocomplete="email"]').fill('visitor@example.com');
  await page.locator('textarea').fill('这里有广告');
  await page.getByRole('button', { name: '提交留言' }).click();

  await expect(page.getByText('留言已提交，待审核后会出现在这里。')).toBeVisible();
});

test('visitor can like the site and search public content', async ({ page }) => {
  let likeToggleCount = 0;
  await page.route('**/api/likes/toggle', async (route) => {
    likeToggleCount += 1;
    await route.fulfill({
      json: { likeCount: likeToggleCount === 1 ? 8 : 7, liked: likeToggleCount === 1 },
    });
  });
  await page.goto('/');
  await enterThroughBootTerminal(page);

  await page.getByRole('button', { name: /Like this site/ }).click();
  await expect(page.getByRole('button', { name: /Liked this site/ })).toBeVisible();
  await page.getByRole('button', { name: /Liked this site/ }).click();
  await expect(page.getByRole('button', { name: /Like this site/ })).toBeVisible();

  await page.route('**/api/search/public?**', async (route) => {
    await route.fulfill({ json: searchResponse() });
  });
  await page.goto('/search?q=spring');

  await expect(page.getByText('Spring Essay')).toBeVisible();
  await expect(page.getByText('Spring Photo')).toBeVisible();
});

// 开屏终端(BootTerminal)开发期每次进入首页都会播放并等待输入,像真实用户一样
// 「回车跳过打字 → 点击屏幕进入」,等它整个卸载后再操作首页。
// 注意 click 必须带短 timeout:终端随时可能卸载,默认 30s 的 locator 等待会卡满全场。
async function enterThroughBootTerminal(page: Page) {
  const terminal = page.locator('.boot-terminal');
  if (!(await terminal.count())) {
    return;
  }

  await page.keyboard.press('Enter');
  await terminal.click({ force: true, timeout: 2000 }).catch(() => undefined);
  try {
    await terminal.waitFor({ state: 'detached', timeout: 8000 });
  } catch {
    // 兜底:点击可能落在 scriptDone 置位之前,再补一轮跳过 + 进入。
    await page.keyboard.press('Enter').catch(() => undefined);
    await terminal.click({ force: true, timeout: 1000 }).catch(() => undefined);
    await terminal.waitFor({ state: 'detached', timeout: 8000 });
  }
}

async function mockPublicShell(page: Page) {
  await page.route('**/api/navigations/public', async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route('**/api/site/settings', async (route) => {
    await route.fulfill({
      json: {
        aboutContent: '<p>About</p>',
        avatarUrl: '',
        faviconUrl: '',
        githubUrl: '',
        homeIntroduction: 'Home intro',
        publicName: 'Public name',
        siteName: 'Site name',
        theme: { primary: 'pink' },
      },
    });
  });
  await page.route('**/api/site/announcement', async (route) => {
    await route.fulfill({ json: null });
  });
  await page.route('**/api/likes/status?targetType=site', async (route) => {
    await route.fulfill({ json: { likeCount: 7, liked: false } });
  });
  await page.route('**/api/mascot/public?**', async (route) => {
    await route.fulfill({ json: null });
  });
  await page.route('**/api/music/public', async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route('**/api/statistics/visit', async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
}

function searchResponse() {
  const pagination = { page: 1, pageSize: 10, total: 0 };

  return {
    query: 'spring',
    sections: {
      essays: {
        items: [
          {
            createdAt: '2026-06-06T00:00:00.000Z',
            excerpt: 'A public essay result.',
            id: 1,
            title: 'Spring Essay',
            type: 'essays',
            url: '/essays/spring',
          },
        ],
        pagination: { ...pagination, total: 1 },
      },
      messages: { items: [], pagination },
      pages: { items: [], pagination },
      photos: {
        items: [
          {
            createdAt: '2026-06-06T00:00:00.000Z',
            excerpt: 'A public photo result.',
            id: 2,
            title: 'Spring Photo',
            type: 'photos',
            url: '/photos',
          },
        ],
        pagination: { ...pagination, total: 1 },
      },
      thoughts: { items: [], pagination },
    },
  };
}
