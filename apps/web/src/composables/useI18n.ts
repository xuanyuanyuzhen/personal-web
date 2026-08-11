import { computed, ref } from 'vue';

export type Locale = 'zh' | 'en' | 'ja';

const STORAGE_KEY = 'yuer.locale';
const locale = ref<Locale>(readStoredLocale());

const localeLabels: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
};

const messages: Record<Locale, Record<string, string>> = {
  zh: {
    'action.back': '返回上一页',
    'action.close': '关闭',
    'action.like': '喜欢',
    'action.liked': '已喜欢',
    'action.loadMore': '加载更多',
    'action.reload': '重新加载',
    'action.retry': '再试一次',
    'app.brand': '语尔',
    'app.preview': '预览模式',
    'error.404.body': '请求的地址没有对应资源，可能已经移动、删除，或链接写错了。',
    'error.404.label': 'Route not found',
    'error.404.title': '404',
    'error.500.body': '服务暂时没有完成响应。你可以稍后重新加载，或返回上一页继续浏览。',
    'error.500.label': 'Service unavailable',
    'error.500.title': '500',
    'error.check.browser': '浏览器可以连接',
    'error.check.network': '网络路径已请求',
    'error.check.service': '目标服务未返回可用页面',
    'feedback.likeFailed': '点赞失败，请稍后重试。',
    'home.announcement': '站点公告',
    'home.announcementBody': '这里会安静收纳碎片、随笔、照片和留言。',
    'home.intro': '一处安静记录的个人站，先把日常、碎念、随笔和照片温柔地收在这里。',
    'home.kicker': '轩辕宇振的个人记录站',
    'home.like': '喜欢本站',
    'home.liked': '已喜欢本站',
    'home.mascot': '看板娘占位',
    'mascot.label': '看板娘',
    'mascot.welcome': '欢迎回来，今天也慢慢记录吧。',
    'music.label': '音乐播放器',
    'music.list': '顺序',
    'music.mode': '播放模式',
    'music.next': '下一首',
    'music.pause': '暂停',
    'music.play': '播放',
    'music.previous': '上一首',
    'music.random': '随机',
    'music.single': '单曲',
    'home.title': '安静记录，也认真生长。',
    'loading.label': '正在翻开这一页',
    'nav.about': '关于我',
    'nav.essays': '随笔',
    'nav.home': '首页',
    'nav.messages': '留言板',
    'nav.photos': '照片墙',
    'terminal.ls': '这里放着碎碎念、随笔、照片和留言。',
    'terminal.skip': '回车跳过',
    'terminal.whoami': '轩辕宇振',
    'nav.thoughts': '碎碎念',
    'page.about.body': '个人介绍、兴趣和建站说明将在后续接入公开设置接口。',
    'page.about.title': '关于我',
    'page.essays.body': '随笔列表和详情页会只读取已发布且公开的文章。',
    'page.essays.title': '随笔',
    'page.messages.body': '留言表单与公开留言列表将在留言模块接入，visitorId 已准备复用。',
    'page.messages.title': '留言板',
    'page.notFound.body': '请求的地址没有对应资源，可能已经移动、删除，或链接写错了。',
    'page.notFound.title': '404',
    'page.photos.body': '照片缩略图、相册筛选和大图预览将在照片模块继续完善。',
    'page.photos.title': '照片墙',
    'page.thoughts.body': '短句碎碎念会在这里安静排列，后续只接入公开列表接口。',
    'page.thoughts.title': '碎碎念',
    'settings.language': '语言',
    'settings.menu': '菜单',
    'search.action': '搜索',
    'search.empty': '没有找到相关内容。',
    'search.error': '搜索失败，请稍后重试。',
    'search.more': '查看完整结果',
    'search.placeholder': '搜索碎碎念、随笔、照片、留言',
    'search.quickTitle': '快速搜索',
    'search.section.essays': '随笔',
    'search.section.messages': '留言',
    'search.section.pages': '页面',
    'search.section.photos': '照片',
    'search.section.thoughts': '碎碎念',
    'search.title': '搜索',
    'settings.theme': '主题',
    'settings.themeDark': '夜间',
    'settings.themeLight': '日间',
  },
  en: {
    'action.back': 'Go back',
    'action.close': 'Close',
    'action.like': 'Like',
    'action.liked': 'Liked',
    'action.loadMore': 'Load more',
    'action.reload': 'Reload',
    'action.retry': 'Try again',
    'app.brand': 'Yuer',
    'app.preview': 'Preview mode',
    'error.404.body':
      'The requested address does not map to an available resource. It may have moved, been removed, or been typed incorrectly.',
    'error.404.label': 'Route not found',
    'error.404.title': '404',
    'error.500.body':
      'The service did not complete the response. Reload in a moment, or go back to keep browsing.',
    'error.500.label': 'Service unavailable',
    'error.500.title': '500',
    'error.check.browser': 'Browser connection available',
    'error.check.network': 'Network path requested',
    'error.check.service': 'Target service did not return a usable page',
    'feedback.likeFailed': 'Unable to update the like. Please try again later.',
    'home.announcement': 'Notice',
    'home.announcementBody': 'A quiet place for notes, essays, photos, and messages.',
    'home.intro': 'A quiet personal journal for daily notes, thoughts, essays, and photos.',
    'home.kicker': 'Xuanyuan Yuzhen personal journal',
    'home.like': 'Like this site',
    'home.liked': 'Liked this site',
    'home.mascot': 'Mascot placeholder',
    'mascot.label': 'Mascot',
    'mascot.welcome': 'Welcome back. Take your time and keep recording.',
    'music.label': 'Music player',
    'music.list': 'List',
    'music.mode': 'Play mode',
    'music.next': 'Next',
    'music.pause': 'Pause',
    'music.play': 'Play',
    'music.previous': 'Previous',
    'music.random': 'Random',
    'music.single': 'Single',
    'home.title': 'Quietly recorded, gently growing.',
    'loading.label': 'Opening this page',
    'nav.about': 'About',
    'nav.essays': 'Essays',
    'nav.home': 'Home',
    'nav.messages': 'Guestbook',
    'nav.photos': 'Photos',
    'nav.thoughts': 'Notes',
    'terminal.ls': 'Notes, essays, photos, and guestbook live here.',
    'terminal.skip': 'Press Enter to skip',
    'terminal.whoami': 'Xuanyuan Yuzhen',
    'page.about.body': 'Profile, interests, and site notes will come from public settings later.',
    'page.about.title': 'About',
    'page.essays.body': 'Essay lists and details will only read published public content.',
    'page.essays.title': 'Essays',
    'page.messages.body':
      'The guestbook form and public message stream will reuse the prepared visitorId.',
    'page.messages.title': 'Guestbook',
    'page.notFound.body':
      'The requested address does not map to an available resource. It may have moved, been removed, or been typed incorrectly.',
    'page.notFound.title': '404',
    'page.photos.body': 'Thumbnails, album filters, and preview will be added by the photo module.',
    'page.photos.title': 'Photos',
    'page.thoughts.body': 'Short notes will live here and use only public list APIs.',
    'page.thoughts.title': 'Notes',
    'settings.language': 'Language',
    'settings.menu': 'Menu',
    'search.action': 'Search',
    'search.empty': 'No matching content yet.',
    'search.error': 'Search failed. Please try again later.',
    'search.more': 'View all results',
    'search.placeholder': 'Search notes, essays, photos, and messages',
    'search.quickTitle': 'Quick Search',
    'search.section.essays': 'Essays',
    'search.section.messages': 'Messages',
    'search.section.pages': 'Pages',
    'search.section.photos': 'Photos',
    'search.section.thoughts': 'Notes',
    'search.title': 'Search',
    'settings.theme': 'Theme',
    'settings.themeDark': 'Dark',
    'settings.themeLight': 'Light',
  },
  ja: {
    'action.back': '前のページへ',
    'action.close': '閉じる',
    'action.like': '好き',
    'action.liked': '好き済み',
    'action.loadMore': 'さらに読み込む',
    'action.reload': '再読み込み',
    'action.retry': 'もう一度',
    'app.brand': '語爾',
    'app.preview': 'プレビューモード',
    'error.404.body':
      '指定されたアドレスに対応するリソースがありません。移動、削除、または入力違いの可能性があります。',
    'error.404.label': 'Route not found',
    'error.404.title': '404',
    'error.500.body':
      'サービスが応答を完了できませんでした。少し待って再読み込みするか、前のページに戻ってください。',
    'error.500.label': 'Service unavailable',
    'error.500.title': '500',
    'error.check.browser': 'ブラウザ接続は利用可能',
    'error.check.network': 'ネットワーク経路をリクエスト済み',
    'error.check.service': '対象サービスが利用可能なページを返しませんでした',
    'feedback.likeFailed':
      '「好き」を更新できませんでした。しばらくしてからもう一度お試しください。',
    'home.announcement': 'お知らせ',
    'home.announcementBody': 'つぶやき、随筆、写真、メッセージを静かに残す場所です。',
    'home.intro': '日々のこと、短いメモ、随筆、写真を静かに置いておく個人サイトです。',
    'home.kicker': '軒轅宇振の個人記録サイト',
    'home.like': 'このサイトが好き',
    'home.liked': 'このサイトが好き済み',
    'home.mascot': '看板娘プレースホルダー',
    'mascot.label': '看板娘',
    'mascot.welcome': 'おかえりなさい。今日もゆっくり記録しましょう。',
    'music.label': '音楽プレーヤー',
    'music.list': '順番',
    'music.mode': '再生モード',
    'music.next': '次へ',
    'music.pause': '一時停止',
    'music.play': '再生',
    'music.previous': '前へ',
    'music.random': 'ランダム',
    'music.single': '単曲',
    'home.title': '静かに記録し、まじめに育つ。',
    'loading.label': 'ページを開いています',
    'nav.about': '私について',
    'nav.essays': '随筆',
    'nav.home': 'ホーム',
    'nav.messages': 'ゲストブック',
    'nav.photos': '写真',
    'nav.thoughts': 'つぶやき',
    'terminal.ls': 'つぶやき、随筆、写真、ゲストブックがここにあります。',
    'terminal.skip': 'Enter でスキップ',
    'terminal.whoami': '軒轅宇振',
    'page.about.body': 'プロフィール、趣味、サイトについては公開設定 API から接続予定です。',
    'page.about.title': '私について',
    'page.essays.body': '随筆一覧と詳細は、公開済みの公開記事だけを読み込みます。',
    'page.essays.title': '随筆',
    'page.messages.body': '留言フォームと公開留言一覧は、準備済みの visitorId を再利用します。',
    'page.messages.title': 'ゲストブック',
    'page.notFound.body':
      '指定されたアドレスに対応するリソースがありません。移動、削除、または入力違いの可能性があります。',
    'page.notFound.title': '404',
    'page.photos.body': 'サムネイル、アルバム絞り込み、プレビューは写真モジュールで追加します。',
    'page.photos.title': '写真',
    'page.thoughts.body': '短いつぶやきはここに並び、公開リスト API だけを使います。',
    'page.thoughts.title': 'つぶやき',
    'settings.language': '言語',
    'settings.menu': 'メニュー',
    'search.action': '検索',
    'search.empty': '該当する内容はありません。',
    'search.error': '検索に失敗しました。もう一度お試しください。',
    'search.more': 'すべての結果を見る',
    'search.placeholder': 'つぶやき、随筆、写真、留言を検索',
    'search.quickTitle': 'クイック検索',
    'search.section.essays': '随筆',
    'search.section.messages': '留言',
    'search.section.pages': 'ページ',
    'search.section.photos': '写真',
    'search.section.thoughts': 'つぶやき',
    'search.title': '検索',
    'settings.theme': 'テーマ',
    'settings.themeDark': '夜',
    'settings.themeLight': '昼',
  },
};

function isLocale(value: string | null): value is Locale {
  return value === 'zh' || value === 'en' || value === 'ja';
}

export function readStoredLocale(): Locale {
  if (typeof window === 'undefined') {
    return 'zh';
  }

  const storedLocale = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(storedLocale) ? storedLocale : 'zh';
}

export function setLocale(nextLocale: Locale | string): void {
  if (!isLocale(nextLocale)) {
    return;
  }

  locale.value = nextLocale;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  }

  if (typeof document !== 'undefined') {
    document.documentElement.lang =
      nextLocale === 'ja' ? 'ja' : nextLocale === 'en' ? 'en' : 'zh-CN';
  }
}

export function initLocale(): void {
  setLocale(readStoredLocale());
}

export function translate(key: string): string {
  return messages[locale.value][key] ?? messages.zh[key] ?? key;
}

export function useI18n() {
  return {
    locale,
    localeLabel: computed(() => localeLabels[locale.value]),
    localeLabels,
    setLocale,
    t: translate,
  };
}
