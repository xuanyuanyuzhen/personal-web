import { chromium } from 'file:///E:/AI_Code/personal-web/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright/index.mjs';

async function probe(url, label, reduce) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const reported = await page.evaluate(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  console.log(`[${label}] prefers-reduced-motion=${reported}`);

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // 确认开屏终端确实出现并在打字
  await page.waitForSelector('.boot-enter-prompt', { timeout: 15000 });
  console.log(`[${label}] 终端出现, 等待提示符就绪`);

  // 点击进入 → 进度条 → 转场
  await page.mouse.click(640, 400);
  await page.waitForSelector('.boot-progress', { timeout: 3000 });
  await page.waitForTimeout(1700); // 进度条填满

  const samples = [];
  for (let i = 0; i < 5; i++) {
    const s = await page.evaluate(() => {
      const t = document.querySelector('.boot-terminal');
      const m = document.querySelector('.site-main');
      const shell = document.querySelector('.site-shell');
      return {
        termOpacity: t ? +getComputedStyle(t).opacity : 'gone',
        mainOpacity: m ? getComputedStyle(m).opacity : '?',
        mainTransform: m ? getComputedStyle(m).transform.slice(0, 30) : '?',
        shellHasReveal: shell ? shell.classList.contains('boot-reveal') : '?',
      };
    });
    samples.push(s);
    await page.waitForTimeout(150);
  }
  console.log(`[${label}] 转场采样:`);
  samples.forEach((s, i) =>
    console.log(
      `  t+${1700 + i * 150}ms 终端=${s.termOpacity} 内容=${s.mainOpacity} transform=${s.mainTransform} shell.boot-reveal=${s.shellHasReveal}`,
    ),
  );

  // 转场中截图
  await page.screenshot({ path: `d:/boot-transition-${label.replace(/[^0-9]/g, '')}.png` });
  await browser.close();
}

(async () => {
  await probe('http://localhost:5175/', '5175-reduce', true);
})();
