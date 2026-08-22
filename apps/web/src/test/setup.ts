// jsdom 没有实现 window.scrollTo。路由现在配了 scrollBehavior，任何真实跳转的测试
// （AppShell / CustomPageView）都会让 vue-router 调它，于是每次都打一串
// 「Error: Not implemented: window.scrollTo」噪声。这里用空实现顶掉，
// 滚动行为本身由 test/routerScroll.spec.ts 直接对 scrollBehavior 断言。
window.scrollTo = () => undefined;
