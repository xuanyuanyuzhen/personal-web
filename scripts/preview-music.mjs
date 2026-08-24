// 音乐播放器视觉预览：mock 音乐接口 + reducedMotion（复刻用户 OS 关闭动画的真实环境），
// 分别拍收起态和展开态、日间和夜间。
//
// 用法：node scripts/preview-music.mjs   （需要 dev server 已在 5173 运行）
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT_DIR = 'tmp-dev-logs/music-preview';
mkdirSync(OUT_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 40000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // 还没起来，继续等
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`dev server not reachable at ${url}`);
}

// 歌词故意给长一些，才看得出滚动容器的高度限制和当前行高亮居中。
const LYRIC = [
  '[00:00.00]晚风穿过窗台',
  '[00:04.00]把白天的声音吹散',
  '[00:08.00]我在这里坐了很久',
  '[00:12.00]看灯一盏盏亮起来',
  '[00:16.00]日子就这样慢慢走',
  '[00:20.00]不急着去哪里',
].join('\n');

const tracks = [
  {
    artist: '语尔',
    createdAt: '2026-08-01T00:00:00.000Z',
    externalUrl: null,
    id: 1,
    isEnabled: true,
    localUrl: '/uploads/music/demo.mp3',
    lyricFileUrl: null,
    lyricText: LYRIC,
    sortOrder: 0,
    title: '晚风与窗台',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    artist: '远山',
    createdAt: '2026-08-02T00:00:00.000Z',
    externalUrl: null,
    id: 2,
    isEnabled: true,
    localUrl: '/uploads/music/demo2.mp3',
    lyricFileUrl: null,
    lyricText: null,
    sortOrder: 1,
    title: '夜色回声',
    updatedAt: '2026-08-02T00:00:00.000Z',
  },
  {
    artist: '很长的艺术家名字用来测试溢出省略',
    createdAt: '2026-08-03T00:00:00.000Z',
    externalUrl: null,
    id: 3,
    isEnabled: true,
    localUrl: '/uploads/music/demo3.mp3',
    lyricFileUrl: null,
    lyricText: null,
    sortOrder: 2,
    title: '一个特别长的歌曲标题用来验证文字截断是否正常工作',
    updatedAt: '2026-08-03T00:00:00.000Z',
  },
];

async function mockApi(page) {
  await page.route('**/api/music/public', (route) => route.fulfill({ json: tracks }));
  await page.route('**/api/navigations/public', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/site/settings', (route) =>
    route.fulfill({ json: { avatarUrl: null, siteName: '语尔', siteSubtitle: null } }),
  );
  await page.route('**/api/site/announcement', (route) => route.fulfill({ json: null }));
  await page.route('**/api/mascot/public', (route) =>
    route.fulfill({ json: { config: null, lines: [] } }),
  );
  await page.route('**/api/likes/status**', (route) =>
    route.fulfill({ json: { likeCount: 0, liked: false } }),
  );
  await page.route('**/api/statistics/visit', (route) => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/essays/public**', (route) =>
    route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 3, total: 0 } } }),
  );
  await page.route('**/api/photos/public**', (route) =>
    route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 4, total: 0 } } }),
  );
  await page.route('**/api/messages/public**', (route) =>
    route.fulfill({ json: { items: [], pagination: { page: 1, pageSize: 3, total: 0 } } }),
  );

  // 音频文件不真实存在，返回一段最小的静音 wav，让 loadedmetadata 能触发出时长。
  await page.route('**/uploads/music/**', (route) =>
    route.fulfill({ body: silentWav(), contentType: 'audio/wav' }),
  );
}

/** 生成一段 30 秒静音 wav，只为让浏览器解析出 duration。 */
function silentWav() {
  const sampleRate = 8000;
  const seconds = 30;
  const samples = sampleRate * seconds;
  const buffer = Buffer.alloc(44 + samples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);

  return buffer;
}

async function shoot(browser, { name, theme, expanded }) {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 860 },
  });
  await context.addInitScript(
    ([mode, isExpanded]) => {
      window.localStorage.setItem('yuer.theme', mode);
      window.localStorage.setItem('yuer.locale', 'zh');
      window.localStorage.setItem(
        'yuer.musicPlayer',
        JSON.stringify({
          currentIndex: 0,
          expanded: isExpanded,
          isMuted: false,
          mode: 'list',
          volume: 0.62,
        }),
      );
      // 跳过开屏终端，直接看首页。
      window.sessionStorage.setItem('yuer.boot.played', '1');
    },
    [theme, expanded],
  );

  const page = await context.newPage();
  await mockApi(page);
  await page.goto('http://localhost:5173/');

  await page.waitForSelector('.music-player', { state: 'visible', timeout: 15000 });
  // 等 loadedmetadata 出时长，再把播放位置推到有歌词高亮的地方。
  //
  // ⚠️ 不能直接 `audio.currentTime = 13`：媒体未就绪时浏览器会忽略这个赋值，
  // 结果截图停在 0:00、歌词高亮第一行，看着像组件坏了。用 defineProperty 覆盖
  // getter 才能稳定复现「播到中途」的画面。
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const audio = document.querySelector('.music-player audio');
    if (!audio) {
      return;
    }

    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 13 });
    audio.dispatchEvent(new Event('timeupdate'));
  });
  await page.waitForTimeout(500);

  const player = page.locator('.music-player');
  await player.screenshot({ path: `${OUT_DIR}/${name}.png` });
  console.log(`saved ${OUT_DIR}/${name}.png`);
  await context.close();
}

await waitForServer('http://localhost:5173/');

const browser = await chromium
  .launch({ channel: process.env.PW_CHANNEL || 'chrome' })
  .catch(() => chromium.launch({ channel: 'msedge' }));

await shoot(browser, { expanded: false, name: 'collapsed-light', theme: 'light' });
await shoot(browser, { expanded: true, name: 'expanded-light', theme: 'light' });
await shoot(browser, { expanded: true, name: 'expanded-dark', theme: 'dark' });

await browser.close();
