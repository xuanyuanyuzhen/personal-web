import { expect, test, type Page } from '@playwright/test';

const adminBaseUrl = 'http://localhost:5174';

test('admin can log in through the dashboard shell', async ({ page }) => {
  await mockAdminShell(page, { authenticated: false });
  await page.route('**/api/auth/login', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: { id: 1, username: 'admin', displayName: 'Administrator' } });
  });

  await page.goto(`${adminBaseUrl}/login?redirect=/dashboard`);
  await page.getByPlaceholder('请输入管理员账号').fill('admin');
  await page.getByPlaceholder('请输入密码').fill('admin123');
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page.locator('h1').filter({ hasText: '仪表盘' })).toBeVisible();
});

test('admin can publish a thought draft', async ({ page }) => {
  await mockAdminShell(page);
  await page.route('**/api/admin/thoughts?**', async (route) => {
    await route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 10, total: 0 } } });
  });
  await page.route('**/api/tags/public?scope=THOUGHT', async (route) => {
    await route.fulfill({ json: [{ id: 1, name: '日常', slug: 'daily', color: null }] });
  });
  await page.route('**/api/admin/thoughts', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { id: 2 } });
      return;
    }
    await route.fallback();
  });

  await page.goto(`${adminBaseUrl}/dashboard/thoughts`);
  await page.getByRole('button', { name: '新增碎碎念' }).click();
  await page.locator('[data-testid="rich-text-editor"] [contenteditable="true"]').fill('今天也慢慢记录。');
  await page.getByRole('button', { name: '保存' }).click();

  await expect(page.getByText('碎碎念已创建')).toBeVisible();
});

test('admin can upload a photo and approve a message', async ({ page }) => {
  await mockAdminShell(page);
  await page.route('**/api/admin/albums?**', async (route) => {
    await route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 10, total: 0 } } });
  });
  await page.route('**/api/admin/photos?**', async (route) => {
    await route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 10, total: 0 } } });
  });
  await page.route('**/api/admin/uploads/photo', async (route) => {
    await route.fulfill({
      json: {
        kind: 'photo',
        original: fileMeta('/uploads/photos/original/2026/06/photo.png'),
        large: fileMeta('/uploads/photos/large/2026/06/photo.png'),
        thumb: fileMeta('/uploads/photos/thumb/2026/06/photo.png'),
      },
    });
  });
  await page.route('**/api/admin/photos', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { id: 1 } });
      return;
    }
    await route.fallback();
  });

  await page.goto(`${adminBaseUrl}/dashboard/photos`);
  await page.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('image'),
    mimeType: 'image/png',
    name: 'photo.png',
  });
  await expect(page.getByText('照片已上传')).toBeVisible();

  await page.route('**/api/admin/messages?**', async (route) => {
    await route.fulfill({
      json: {
        items: [
          {
            auditStatus: 'PENDING',
            avatarUrl: null,
            blacklistMatched: false,
            content: '请审核这条留言',
            email: 'reader@example.com',
            hitWords: ['测试'],
            id: 1,
            nickname: '读者',
            visitorId: 'visitor-1',
          },
        ],
        pagination: { page: 1, pageSize: 10, total: 1 },
      },
    });
  });
  await page.route('**/api/admin/forbidden-words?**', async (route) => {
    await route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 10, total: 0 } } });
  });
  await page.route('**/api/admin/blacklist?**', async (route) => {
    await route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 10, total: 0 } } });
  });
  await page.route('**/api/admin/messages/1/audit', async (route) => {
    await route.fulfill({ json: { id: 1, auditStatus: 'APPROVED' } });
  });

  await page.goto(`${adminBaseUrl}/dashboard/messages`);
  await page.getByRole('button', { name: '通过' }).click();
  await expect(page.getByText('留言已通过')).toBeVisible();
});

async function mockAdminShell(page: Page, options: { authenticated?: boolean } = {}) {
  const authenticated = options.authenticated ?? true;

  await page.route('**/api/auth/me', async (route) => {
    if (!authenticated) {
      await route.fulfill({ json: { message: '未登录' }, status: 401 });
      return;
    }

    await route.fulfill({ json: { id: 1, username: 'admin', displayName: 'Administrator' } });
  });
  await page.route('**/api/admin/statistics', async (route) => {
    await route.fulfill({
      json: {
        likes: { byType: [], last7Days: [], total: 0 },
        visits: { byPageType: [], last7Days: [], total: 0 },
      },
    });
  });
}

function fileMeta(url: string) {
  return {
    filename: 'photo.png',
    mimeType: 'image/png',
    originalName: 'photo.png',
    relativePath: url.replace('/uploads/', ''),
    size: 5,
    storagePath: url.replace('/uploads/', ''),
    url,
  };
}
