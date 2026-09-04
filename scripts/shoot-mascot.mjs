/**
 * 看板娘精灵图目视验证：把前台跑起来，逐帧定格截图。
 *
 * 前置：另开一个终端跑 `pnpm --filter @yuer/web dev`（本脚本不负责启服务）。
 * 运行：node scripts/shoot-mascot.mjs
 * 产物：tmp-sprite-preview/shot-*.png
 *
 * 为什么不按时间间隔连拍：idle 8fps 每帧只有 125ms，靠 setTimeout 抓帧会漂。
 * 这里改成给动画加 `animation-play-state: paused` 再用负的 animation-delay 定位，
 * 等价于「seek 到第 n 帧然后暂停」，取样是确定的。
 */
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';

const OUT = 'tmp-sprite-preview';
const BASE = 'http://localhost:5173';

// 与后台「网格与状态」保持一致；改这里就能不碰数据库直接试参数。
// 素材由 prep-mascot-sprite.py build --rows 0 6 3 5 7 生成，新行 0..4 依次是：
// 站姿动作A / 站姿动作B / 挥手 / 情绪姿势组(取睡姿) / 打字。
const MODEL_CONFIG = {
  cols: 8,
  flipX: true,
  renderer: 'sprite',
  rows: 5,
  spriteUrl: '/mascot/pets/elysia/sprite.webp',
  states: {
    // 默认就是站着不动：动作行的第 0 帧本身就是自然站姿
    stand: { frames: 1, row: 0 },
    gestureA: { fps: 6, frames: 6, row: 0 },
    gestureB: { fps: 6, frames: 6, row: 1 },
    react: { fps: 6, frames: 4, row: 2 },
    // 睡姿是情绪姿势组里的第 4 帧，定格不循环
    sleep: { frames: 1, offset: 4, row: 3 },
    typing: { fps: 12, frames: 6, row: 4 },
  },
};

function channel() {
  if (existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) return 'chrome';
  if (existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'))
    return 'msedge';
  return undefined;
}

async function mockApi(page) {
  const json = (body) => async (route) => route.fulfill({ json: body });

  await page.route('**/api/navigations/public', json([]));
  await page.route('**/api/site/announcement', json(null));
  await page.route('**/api/music/public', json([]));
  await page.route('**/api/statistics/visit', json({ ok: true }));
  await page.route('**/api/likes/status?targetType=site', json({ likeCount: 7, liked: false }));
  await page.route(
    '**/api/site/settings',
    json({
      aboutContent: '<p>About</p>',
      avatarUrl: '',
      faviconUrl: '',
      githubUrl: '',
      homeIntroduction: 'Home intro',
      publicName: 'Public name',
      siteName: 'Site name',
      theme: { primary: 'pink' },
    }),
  );
  await page.route(
    '**/api/mascot/public?**',
    json({
      id: 1,
      imageUrl: '',
      modelConfig: MODEL_CONFIG,
      name: '默认看板娘',
      pageKey: 'home',
      pageLine: { content: '看板娘精灵图验证', id: 1, isEnabled: true, pageKey: 'home', weight: 1 },
      randomLines: [{ content: '点我一下', id: 2, isEnabled: true, pageKey: 'home', weight: 1 }],
    }),
  );
}

/** 开屏终端在 dev 下必定播放，会盖住页面，先跳过。 */
async function skipBootTerminal(page) {
  const terminal = page.locator('.boot-terminal');
  if ((await terminal.count()) === 0) return;

  await page.keyboard.press('Enter');
  await terminal.click({ force: true, timeout: 2000 }).catch(() => undefined);
  try {
    await terminal.waitFor({ state: 'detached', timeout: 8000 });
  } catch {
    await page.keyboard.press('Enter').catch(() => undefined);
    await terminal.click({ force: true, timeout: 1000 }).catch(() => undefined);
    await terminal.waitFor({ state: 'detached', timeout: 8000 });
  }
}

const browser = await chromium.launch({ channel: channel() });
const page = await browser.newPage({ viewport: { height: 900, width: 1280 } });

await mockApi(page);
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await skipBootTerminal(page);

const button = page.locator('.mascot-figure-button');
await button.waitFor({ state: 'visible', timeout: 15000 });
await page.locator('.sprite-mascot-sheet').waitFor({ state: 'visible', timeout: 15000 });
// 等图片真正解码完，否则第一帧可能拍到空白
await page.waitForFunction(
  () => {
    const img = document.querySelector('.sprite-mascot-sheet');
    return img && img.complete && img.naturalWidth > 0;
  },
  null,
  { timeout: 15000 },
);

mkdirSync(OUT, { recursive: true });

// 整体观感：连同气泡一起拍，看在页面里的实际大小。
// 默认状态是 stand（定格单帧），所以这张就是「静止站立」的样子。
await page.locator('.mascot-widget').screenshot({ path: `${OUT}/shot-widget.png` });
console.log(`stand -> ${OUT}/shot-widget.png  (row=${await readSpriteRow(page)})`);

// 逐帧定格：seek 到每一帧的中点再暂停。
// 拍的是 gestureA（站久了插播的小动作），因为 stand 本身就是定格单帧。
// 直接改组件状态等 10~30 秒太慢，这里注入一个假的动画配置来定格取样。
const { frames, fps } = MODEL_CONFIG.states.gestureA;
const frameMs = 1000 / fps;
await page.addStyleTag({
  content: `.sprite-mascot-sheet {
    animation: sprite-play ${frames / fps}s steps(${frames}) infinite !important;
    --sprite-frames: ${frames};
    --sprite-row: ${MODEL_CONFIG.states.gestureA.row};
    --sprite-offset: 0;
  }`,
});
for (let i = 0; i < frames; i += 1) {
  const seek = Math.round(i * frameMs + frameMs / 2);
  await page.addStyleTag({
    content: `.sprite-mascot-sheet {
      animation-play-state: paused !important;
      animation-delay: -${seek}ms !important;
    }`,
  });
  await button.screenshot({ path: `${OUT}/shot-gesture-${i}.png` });
}

console.log(`gestureA -> ${OUT}/shot-gesture-0..${frames - 1}.png`);

// 打字状态：首页没有输入框，去搜索页敲字。
// MascotWidget 挂在 AppShell 上，路由切换不会重挂载，所以状态机是连续的。
await page.addStyleTag({
  content: '.sprite-mascot-sheet { animation-play-state: running !important; }',
});
await page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
await skipBootTerminal(page);

const typingTarget = page.locator('input, textarea').first();
try {
  await typingTarget.waitFor({ state: 'visible', timeout: 10000 });

  // 先只聚焦不打字：打字状态应该由焦点决定，光点进去就该坐到键盘前。
  await typingTarget.focus();
  await page.waitForTimeout(150);
  const focusRow = await readSpriteRow(page);
  await page.locator('.mascot-widget').screenshot({ path: `${OUT}/shot-focus.png` });
  console.log(`focus -> ${OUT}/shot-focus.png  (row=${focusRow})`);

  await typingTarget.type('hello', { delay: 120 });
  await page.locator('.mascot-widget').screenshot({ path: `${OUT}/shot-typing.png` });
  const typed = await page.evaluate(() => {
    const cap = document.querySelector('.mascot-keycap');

    return cap ? cap.textContent.trim() : null;
  });
  console.log(`typing -> ${OUT}/shot-typing.png  (keycap=${JSON.stringify(typed)})`);

  // 移开焦点应当回到站立待机，而不是继续坐着
  await typingTarget.blur();
  await page.waitForTimeout(200);
  console.log(`blur  -> row=${await readSpriteRow(page)}（应回到 0 或 1）`);
} catch (error) {
  console.log('typing -> 跳过：', error.message);
}

await browser.close();

async function readSpriteRow(target) {
  return target.evaluate(() => {
    const sheet = document.querySelector('.sprite-mascot-sheet');

    return sheet ? getComputedStyle(sheet).getPropertyValue('--sprite-row').trim() : null;
  });
}
