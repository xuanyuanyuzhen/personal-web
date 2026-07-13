export type LocalNavigationItem = {
  id: string;
  labelKey: string;
  path: string;
  order: number;
  type: 'internal';
  children?: LocalNavigationItem[];
};

export type ApiNavigationItem = {
  id: number | string;
  key: string;
  title: string;
  type: 'INTERNAL' | 'EXTERNAL' | 'PAGE' | string;
  path: string | null;
  url: string | null;
  target: string | null;
  page: {
    id: number | string;
    title: string;
    slug: string;
  } | null;
  sortOrder?: number;
  children?: ApiNavigationItem[];
};

export type RenderedNavigationItem = {
  id: string;
  label: string;
  kind: 'internal' | 'external';
  to?: string;
  href?: string;
  target?: string | null;
  order: number;
  children: RenderedNavigationItem[];
};

export const publicNavigation: LocalNavigationItem[] = [
  {
    id: 'home',
    labelKey: 'nav.home',
    path: '/',
    order: 1,
    type: 'internal',
  },
  {
    id: 'thoughts',
    labelKey: 'nav.thoughts',
    path: '/thoughts',
    order: 2,
    type: 'internal',
  },
  {
    id: 'essays',
    labelKey: 'nav.essays',
    path: '/essays',
    order: 3,
    type: 'internal',
  },
  {
    id: 'photos',
    labelKey: 'nav.photos',
    path: '/photos',
    order: 4,
    type: 'internal',
  },
  {
    id: 'messages',
    labelKey: 'nav.messages',
    path: '/messages',
    order: 5,
    type: 'internal',
  },
  {
    id: 'about',
    labelKey: 'nav.about',
    path: '/about',
    order: 6,
    type: 'internal',
  },
];

export function mapLocalNavigation(
  navigation: LocalNavigationItem[],
  translate: (key: string) => string,
): RenderedNavigationItem[] {
  return navigation
    .map((item) => ({
      id: item.id,
      label: translate(item.labelKey),
      kind: 'internal' as const,
      to: item.path,
      order: item.order,
      children: mapLocalNavigation(item.children ?? [], translate),
    }))
    .sort(compareNavigationOrder);
}

export function mapApiNavigation(
  navigation: ApiNavigationItem[],
  translate?: (key: string) => string,
): RenderedNavigationItem[] {
  return navigation
    .map((item, index) => mapApiNavigationItem(item, index, translate))
    .filter((item): item is RenderedNavigationItem => item !== null)
    .sort(compareNavigationOrder);
}

function mapApiNavigationItem(
  item: ApiNavigationItem,
  index: number,
  translate?: (key: string) => string,
): RenderedNavigationItem | null {
  const type = item.type.toUpperCase();
  const base = {
    id: String(item.id),
    label: resolveApiNavigationLabel(item, translate),
    order: typeof item.sortOrder === 'number' ? item.sortOrder : index,
    children: mapApiNavigation(item.children ?? [], translate),
  };

  if (type === 'EXTERNAL') {
    if (!item.url) {
      return null;
    }

    return {
      ...base,
      kind: 'external',
      href: item.url,
      target: item.target,
    };
  }

  if (type === 'PAGE') {
    if (!item.page?.slug) {
      return null;
    }

    return {
      ...base,
      kind: 'internal',
      to: `/pages/${item.page.slug}`,
    };
  }

  if (!item.path) {
    return null;
  }

  return {
    ...base,
    kind: 'internal',
    to: item.path,
  };
}

function resolveApiNavigationLabel(
  item: ApiNavigationItem,
  translate?: (key: string) => string,
): string {
  const localItem = publicNavigation.find(
    (navigationItem) =>
      navigationItem.id === item.key && item.path !== null && navigationItem.path === item.path,
  );

  if (localItem && translate) {
    return translate(localItem.labelKey);
  }

  return item.title || item.page?.title || item.key;
}

function compareNavigationOrder(
  first: RenderedNavigationItem,
  second: RenderedNavigationItem,
): number {
  return first.order - second.order;
}
