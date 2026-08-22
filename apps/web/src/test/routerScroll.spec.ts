import type { RouteLocationNormalized } from 'vue-router';
import { router } from '../router';

// scrollBehavior 是路由配置里的纯函数，直接调它比在 jsdom 里模拟真实滚动可靠得多。
const scrollBehavior = router.options.scrollBehavior!;

function location(name: string, path: string, hash = ''): RouteLocationNormalized {
  return { fullPath: path + hash, hash, name, path, query: {} } as RouteLocationNormalized;
}

function call(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  savedPosition: { left: number; top: number } | null = null,
) {
  return scrollBehavior.call(router, to, from, savedPosition);
}

describe('router scrollBehavior', () => {
  it('scrolls to the top when navigating to another page', () => {
    const result = call(location('thoughts', '/thoughts'), location('home', '/'));

    expect(result).toEqual({ left: 0, top: 0 });
  });

  it('restores the saved position on browser back/forward', async () => {
    vi.useFakeTimers();

    try {
      const pending = call(location('home', '/'), location('essays', '/essays'), {
        left: 0,
        top: 640,
      });

      await vi.advanceTimersByTimeAsync(300);

      // 要等新页面渲染出高度才能滚回去，所以是个延时 Promise，不是同步返回。
      await expect(pending).resolves.toEqual({ left: 0, top: 640 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the scroll position when only the query changes on the same route', () => {
    // 搜索页换关键词 / 翻页走的是同路由 + 新 query，滚动条不能被弹回顶部。
    const result = call(location('search', '/search'), location('search', '/search'));

    expect(result).toBe(false);
  });

  it('defers to the anchor when the target has a hash', () => {
    const result = call(location('about', '/about', '#contact'), location('home', '/'));

    expect(result).toEqual({ el: '#contact', top: 88 });
  });
});
