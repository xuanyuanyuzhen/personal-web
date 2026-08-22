// 首页重构预览截图脚本:mock API + reduced-motion(复刻用户 OS 关闭动画的真实环境)。
// 用法: node scripts/preview-home.mjs   (需要 dev server 已在 5173 运行)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT_DIR = 'tmp-dev-logs/home-preview';
mkdirSync(OUT_DIR, { recursive: true });

// dev server 可能刚被拉起,先等 5173 就绪。
async function waitForServer(url, timeoutMs = 40000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // 还没起来,继续等
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`dev server not reachable at ${url}`);
}

const essays = [1, 2, 3].map((id) => ({
  category: { id: 1, name: '札记', slug: 'notes' },
  categoryId: 1,
  content: `<p>正文 ${id}</p>`,
  coverUrl: `/uploads/cover-${id}.jpg`,
  createdAt: `2026-08-0${id}T00:00:00.000Z`,
  id,
  isPinned: false,
  likeCount: 2,
  liked: false,
  publishedAt: `2026-08-0${id}T00:00:00.000Z`,
  slug: `essay-${id}`,
  summary: '八月的傍晚,风把云推得很慢,我在阳台上读完了这本拖了很久的书。',
  tags: [],
  title: ['把日子过成随笔', '深夜书桌与一盏灯', '给三个月后的自己'][id - 1],
  updatedAt: `2026-08-0${id}T00:00:00.000Z`,
}));

const photos = [1, 2, 3, 4].map((id) => ({
  album: null,
  albumId: null,
  createdAt: `2026-08-0${id}T00:00:00.000Z`,
  description: null,
  id: 10 + id,
  largeUrl: null,
  likeCount: 0,
  liked: false,
  originalUrl: `/uploads/photo-${id}.jpg`,
  sortOrder: id,
  thumbUrl: `/uploads/photo-${id}.jpg`,
  title: ['落日堤岸', '雨后的巷口', '窗台上的猫', '晚风与霓虹'][id - 1],
  updatedAt: `2026-08-0${id}T00:00:00.000Z`,
}));

const messages = [
  {
    avatarUrl: null,
    content: '在这里看到了很安静的文字,像晚风一样舒服。',
    createdAt: '2026-08-10T00:00:00.000Z',
    id: 21,
    nickname: '临风',
    updatedAt: '2026-08-10T00:00:00.000Z',
  },
  {
    avatarUrl: null,
    content: '照片墙的色调好温柔,期待更新!',
    createdAt: '2026-08-09T00:00:00.000Z',
    id: 22,
    nickname: '小满',
    updatedAt: '2026-08-09T00:00:00.000Z',
  },
  {
    avatarUrl: null,
    content: '路过留名,祝网站越来越好。',
    createdAt: '2026-08-08T00:00:00.000Z',
    id: 23,
    nickname: 'Aki',
    updatedAt: '2026-08-08T00:00:00.000Z',
  },
];

const svgColors = {
  'cover-1': ['#f2a0bd', '#e6c384'],
  'cover-2': ['#bb86c9', '#f2a0bd'],
  'cover-3': ['#7fb5d6', '#e9c9f0'],
  'photo-1': ['#f0b48a', '#e0568f'],
  'photo-2': ['#9fbf90', '#e6c384'],
  'photo-3': ['#c9a0dc', '#96b8e0'],
  'photo-4': ['#e08f8f', '#e6c384'],
};

function svgFor(name) {
  const [from, to] = svgColors[name] ?? ['#e0568f', '#e6c384'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="960" height="640" fill="url(#g)"/><circle cx="740" cy="140" r="90" fill="rgba(255,255,255,.35)"/><text x="60" y="580" font-size="42" fill="rgba(255,255,255,.85)" font-family="sans-serif">${name}</text></svg>`;
}

async function mockApi(page) {
  const page1 = (items, total) => ({
    items,
    pagination: { page: 1, pageSize: items.length, total },
  });
  const routes = {
    '**/api/site/settings': {
      aboutContent: '<p>关于我</p>',
      avatarUrl: '',
      faviconUrl: '',
      githubUrl: '',
      homeIntroduction: '一处安静记录的个人站,把日常、碎念、随笔和照片温柔地收在这里。',
      publicName: '轩辕宇振的个人记录站',
      siteName: '语尔 · 安静记录,也认真生长',
      theme: {},
    },
    '**/api/site/announcement': {
      content: '<p>照片墙新增了「夏末」相册,欢迎来逛逛。</p>',
      isEnabled: true,
      publishedAt: '2026-08-10T00:00:00.000Z',
      title: '站点公告',
    },
    '**/api/likes/status?targetType=site': { likeCount: 128, liked: false },
    '**/api/mascot/public**': null,
    '**/api/music/public': [],
    '**/api/statistics/visit': { ok: true },
  };

  for (const [pattern, json] of Object.entries(routes)) {
    await page.route(pattern, (route) => route.fulfill({ json }));
  }

  // 导航接口给 404,让前台回退到本地导航配置(首页/碎碎念/随笔/照片墙/留言板/关于我)。
  await page.route('**/api/navigations/public', (route) =>
    route.fulfill({ body: 'not found', status: 404 }),
  );
  await page.route('**/api/essays/public?**', (route) =>
    route.fulfill({ json: page1(essays, 12) }),
  );
  await page.route('**/api/photos/public?**', (route) =>
    route.fulfill({ json: page1(photos, 36) }),
  );
  await page.route('**/api/messages/public?**', (route) =>
    route.fulfill({ json: page1(messages, 57) }),
  );
  await page.route('**/uploads/**', (route) => {
    const name =
      route
        .request()
        .url()
        .match(/uploads\/([\w-]+)\.jpg/)?.[1] ?? 'cover-1';
    return route.fulfill({ body: svgFor(name), contentType: 'image/svg+xml' });
  });
  // 临时背景图:模拟用户放进 public/bg/ 的真实照片,用来检查毛玻璃层次。
  await page.route('**/preview-backdrop.svg', (route) =>
    route.fulfill({ body: backdropSvg(), contentType: 'image/svg+xml' }),
  );
}

function backdropSvg() {
  const blobs = [
    [220, 180, 260, '#e0568f', 0.55],
    [1180, 240, 300, '#7fb5d6', 0.5],
    [640, 620, 340, '#e6c384', 0.5],
    [1420, 760, 280, '#9fbf90', 0.45],
    [300, 820, 220, '#c9a0dc', 0.5],
  ]
    .map(
      ([cx, cy, r, fill, opacity]) =>
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="${opacity}"/>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#f6d9e6"/>${blobs}<g stroke="#b93c6d" stroke-width="3" opacity="0.35">${Array.from({ length: 22 }, (_, i) => `<line x1="${i * 76}" y1="0" x2="${i * 76 - 240}" y2="1000"/>`).join('')}</g></svg>`;
}

async function shoot(browser, { name, theme, width, height, withBackdrop }) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width, height },
  });
  await context.addInitScript(
    ([mode]) => {
      window.localStorage.setItem('yuer.theme', mode);
      window.localStorage.setItem('yuer.locale', 'zh');
    },
    [theme],
  );

  const page = await context.newPage();
  await mockApi(page);
  await page.goto('http://localhost:5173/');

  // withBackdrop:用仓库里真实的 public/bg/home.jpg 出图(不注入任何样式,
  // 完全按 styles.css 当前的 --bg-image / --bg-veil / --bg-blur 渲染);
  // 否则把背景图关掉,看纯色底下的排版。
  if (!withBackdrop) {
    await page.addStyleTag({
      content: `:root,:root[data-theme='dark']{--bg-image:none;--bg-veil:100%;}`,
    });
  }

  // 开屏终端:回车跳过打字,再点击屏幕进入首页;等终端整个卸载后再截图。
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const terminal = page.locator('.boot-terminal');
  if (await terminal.count()) {
    await terminal.click({ force: true }).catch(() => undefined);
  }
  await page.waitForSelector('.boot-terminal', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('.home-panel', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ fullPage: true, path: `${OUT_DIR}/${name}.png` });
  console.log(`saved ${OUT_DIR}/${name}.png`);
  await context.close();
}

const browser = await chromium
  .launch({ channel: process.env.PW_CHANNEL || 'chrome' })
  .catch(() => chromium.launch({ channel: 'msedge' }));

try {
  await waitForServer('http://localhost:5173/');
  await shoot(browser, { height: 900, name: 'home-light', theme: 'light', width: 1440 });
  await shoot(browser, { height: 900, name: 'home-dark', theme: 'dark', width: 1440 });
  await shoot(browser, { height: 844, name: 'home-mobile', theme: 'light', width: 390 });
  // 带背景图的版本:检查「导航栏最实 > 内容卡 > 整栏面板最透」三层毛玻璃。
  await shoot(browser, {
    height: 900,
    name: 'home-light-bg',
    theme: 'light',
    width: 1440,
    withBackdrop: true,
  });
  await shoot(browser, {
    height: 900,
    name: 'home-dark-bg',
    theme: 'dark',
    width: 1440,
    withBackdrop: true,
  });
} finally {
  await browser.close();
}
