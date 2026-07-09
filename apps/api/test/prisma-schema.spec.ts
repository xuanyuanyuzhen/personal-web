import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const apiRoot = join(__dirname, '..');
const schemaPath = join(apiRoot, 'prisma', 'schema.prisma');
const seedPath = join(apiRoot, 'prisma', 'seed.cjs');

describe('Prisma schema', () => {
  const schema = readFileSync(schemaPath, 'utf8');

  it('uses MySQL and DATABASE_URL', () => {
    expect(schema).toContain('provider = "mysql"');
    expect(schema).toContain('url      = env("DATABASE_URL")');
  });

  it('defines the first database model set', () => {
    [
      'Admin',
      'Navigation',
      'CustomPage',
      'Thought',
      'Essay',
      'EssayCategory',
      'Photo',
      'Album',
      'Message',
      'Comment',
      'Like',
      'Tag',
      'TagScope',
      'TagRelation',
      'ForbiddenWord',
      'BlacklistItem',
      'AuditRecord',
      'Music',
      'Mascot',
      'MascotLine',
      'Setting',
      'Announcement',
      'VisitLog',
      'OperationLog',
      'RecycleBinItem',
    ].forEach((modelName) => {
      expect(schema).toContain(`model ${modelName} `);
    });
  });

  it('keeps the required uniqueness constraints', () => {
    expect(schema).toContain('username        String    @unique');
    expect(schema).toContain('@@unique([visitorId, targetType, targetId])');
    expect(schema).toContain('@@unique([tagId, targetType, targetId])');
    expect(schema).toContain('@@unique([tagId, targetType])');
  });

  it('centralizes status and target enums', () => {
    expect(schema).toContain('enum PublishStatus');
    expect(schema).toContain('DRAFT');
    expect(schema).toContain('PUBLISHED');
    expect(schema).toContain('enum Visibility');
    expect(schema).toContain('PUBLIC');
    expect(schema).toContain('PRIVATE');
    expect(schema).toContain('enum AuditStatus');
    expect(schema).toContain('enum TargetType');
  });
});

describe('Prisma seed', () => {
  const seed = readFileSync(seedPath, 'utf8');

  it('hashes the default admin password before storing it', () => {
    expect(seed).toContain("DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'admin123'");
    expect(seed).toContain('passwordHash: await createPasswordHash(DEFAULT_ADMIN_PASSWORD)');
    expect(seed).not.toContain("passwordHash: 'admin123'");
    expect(seed).toContain('prisma.admin.upsert');
  });
});
