const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_INITIAL_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'admin123';

async function createPasswordHash(password) {
  const salt = randomBytes(16).toString('hex');
  const params = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
  const derivedKey = await scryptAsync(password, salt, 64, params);

  return `scrypt$N=${params.N},r=${params.r},p=${params.p}$${salt}$${derivedKey.toString('hex')}`;
}

async function seedAdmin() {
  await prisma.admin.upsert({
    where: { username: DEFAULT_ADMIN_USERNAME },
    update: {
      displayName: 'Administrator',
    },
    create: {
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash: await createPasswordHash(DEFAULT_ADMIN_PASSWORD),
      displayName: 'Administrator',
    },
  });
}

async function seedSettings() {
  const settings = [
    {
      key: 'site.name',
      group: 'site',
      value: '语尔',
      description: 'Website name',
    },
    {
      key: 'site.publicName',
      group: 'site',
      value: '轩辕宇振',
      description: 'Public display name',
    },
    {
      key: 'site.introduction',
      group: 'site',
      value: '安静记录碎片、随笔、照片和一点点日常灵感。',
      description: 'Home page introduction',
    },
    {
      key: 'site.githubUrl',
      group: 'site',
      value: '',
      description: 'GitHub profile URL',
    },
    {
      key: 'site.avatarUrl',
      group: 'site',
      value: '',
      description: 'Avatar URL',
    },
    {
      key: 'site.faviconUrl',
      group: 'theme',
      value: '',
      description: 'Reserved favicon URL',
    },
    {
      key: 'about.content',
      group: 'about',
      value: '<p>这里会慢慢补上关于我的介绍。</p>',
      description: 'About page content',
    },
    {
      key: 'site.theme',
      group: 'theme',
      value: {
        primary: 'pink',
        faviconReserved: true,
      },
      description: 'Reserved theme configuration',
    },
    {
      key: 'operationLog.retentionDays',
      group: 'governance',
      value: 90,
      description: 'Operation log retention days',
    },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {
        group: setting.group,
        value: setting.value,
        description: setting.description,
      },
      create: setting,
    });
  }
}

async function seedNavigation() {
  const navigations = [
    { key: 'home', title: '首页', path: '/', sortOrder: 10 },
    { key: 'thoughts', title: '碎碎念', path: '/thoughts', sortOrder: 20 },
    { key: 'essays', title: '随笔', path: '/essays', sortOrder: 30 },
    { key: 'photos', title: '照片墙', path: '/photos', sortOrder: 40 },
    { key: 'messages', title: '留言板', path: '/messages', sortOrder: 50 },
    { key: 'about', title: '关于我', path: '/about', sortOrder: 60 },
  ];

  for (const item of navigations) {
    await prisma.navigation.upsert({
      where: { key: item.key },
      update: {
        title: item.title,
        type: 'INTERNAL',
        path: item.path,
        sortOrder: item.sortOrder,
        isEnabled: true,
      },
      create: {
        ...item,
        type: 'INTERNAL',
        isEnabled: true,
      },
    });
  }
}

async function seedAnnouncement() {
  const content = '<p>这里会安静收纳碎片、随笔、照片和留言。</p>';

  await prisma.announcement.upsert({
    where: { key: 'home' },
    update: {
      title: '欢迎来到语尔',
      content,
      isEnabled: true,
    },
    create: {
      key: 'home',
      title: '欢迎来到语尔',
      content,
      isEnabled: true,
      publishedAt: new Date(),
    },
  });
}

async function seedMascot() {
  const mascot = await prisma.mascot.upsert({
    where: { key: 'default' },
    update: {
      name: '默认看板娘',
      imageUrl: '/uploads/site/mascot/placeholder.png',
      displayScopes: ['*'],
      isEnabled: true,
    },
    create: {
      key: 'default',
      name: '默认看板娘',
      imageUrl: '/uploads/site/mascot/placeholder.png',
      displayScopes: ['*'],
      live2dConfig: {
        reserved: true,
      },
      isEnabled: true,
    },
  });

  const lines = [
    {
      key: 'default-home',
      pageKey: 'home',
      content: '欢迎回来，今天也慢慢记录吧。',
      weight: 5,
      isRandom: false,
      sortOrder: 10,
    },
    {
      key: 'default-random-1',
      pageKey: '*',
      content: '翻到这里的时候，也许正好有一小片灵感。',
      weight: 3,
      isRandom: true,
      sortOrder: 20,
    },
  ];

  for (const line of lines) {
    await prisma.mascotLine.upsert({
      where: { key: line.key },
      update: {
        mascotId: mascot.id,
        pageKey: line.pageKey,
        content: line.content,
        weight: line.weight,
        isRandom: line.isRandom,
        isEnabled: true,
        sortOrder: line.sortOrder,
      },
      create: {
        ...line,
        mascotId: mascot.id,
        isEnabled: true,
      },
    });
  }
}

async function main() {
  await seedAdmin();
  await seedSettings();
  await seedNavigation();
  await seedAnnouncement();
  await seedMascot();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
