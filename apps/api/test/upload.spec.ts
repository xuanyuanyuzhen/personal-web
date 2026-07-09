import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from '../src/uploads/upload.service';
import { UploadedFile } from '../src/uploads/upload.types';

describe('UploadService', () => {
  let service: UploadService;
  let uploadDir: string;
  const originalUploadDir = process.env.UPLOAD_DIR;
  const originalPublicBaseUrl = process.env.PUBLIC_UPLOAD_BASE_URL;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'yuer-upload-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.PUBLIC_UPLOAD_BASE_URL = '/assets';
    service = new UploadService();
  });

  afterEach(async () => {
    restoreEnv('UPLOAD_DIR', originalUploadDir);
    restoreEnv('PUBLIC_UPLOAD_BASE_URL', originalPublicBaseUrl);
    await rm(uploadDir, { force: true, recursive: true });
  });

  it('stores image files with separate storage path and public URL', async () => {
    const result = await service.saveFile('image', file({ mimetype: 'image/png', originalname: 'note.png' }));

    expect(result.kind).toBe('image');
    if (result.kind === 'photo') {
      throw new Error('expected single image metadata');
    }
    expect(result.url).toMatch(/^\/assets\/images\/\d{4}\/\d{2}\//);
    expect(result.storagePath).toMatch(/^images\/\d{4}\/\d{2}\//);
    await expect(readFile(join(uploadDir, result.storagePath))).resolves.toEqual(Buffer.from('file'));
  });

  it('rejects unsupported image formats and oversized images', async () => {
    await expect(
      service.saveFile('image', file({ mimetype: 'text/plain', originalname: 'note.txt' })),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.saveFile('image', file({ mimetype: 'image/png', originalname: 'huge.png', size: 10 * 1024 * 1024 + 1 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates music and lyric formats and music size', async () => {
    await expect(
      service.saveFile('music', file({ mimetype: 'audio/mpeg', originalname: 'song.mp3' })),
    ).resolves.toMatchObject({ kind: 'music' });
    await expect(
      service.saveFile('music', file({ mimetype: 'audio/mpeg', originalname: 'huge.mp3', size: 20 * 1024 * 1024 + 1 })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.saveFile('lyric', file({ mimetype: 'text/plain', originalname: 'song.lrc' })),
    ).resolves.toMatchObject({ kind: 'lyric' });
    await expect(
      service.saveFile('lyric', file({ mimetype: 'text/plain', originalname: 'song.doc' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps mascot image format validation without size limit', async () => {
    await expect(
      service.saveFile('mascot', file({ mimetype: 'image/webp', originalname: 'mascot.webp', size: 50 * 1024 * 1024 })),
    ).resolves.toMatchObject({ kind: 'mascot' });
    await expect(
      service.saveFile('mascot', file({ mimetype: 'application/json', originalname: 'mascot.json' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns original, large, and thumb metadata for photos', async () => {
    const result = await service.saveFile('photo', file({ mimetype: 'image/jpeg', originalname: 'photo.jpeg' }));

    expect(result.kind).toBe('photo');
    if (result.kind !== 'photo') {
      throw new Error('expected photo metadata');
    }
    expect(result.original.storagePath).toMatch(/^photos\/original\/\d{4}\/\d{2}\//);
    expect(result.large.storagePath).toMatch(/^photos\/large\/\d{4}\/\d{2}\//);
    expect(result.thumb.storagePath).toMatch(/^photos\/thumb\/\d{4}\/\d{2}\//);
    await expect(readFile(join(uploadDir, result.original.storagePath))).resolves.toEqual(Buffer.from('file'));
    await expect(readFile(join(uploadDir, result.large.storagePath))).resolves.toEqual(Buffer.from('file'));
    await expect(readFile(join(uploadDir, result.thumb.storagePath))).resolves.toEqual(Buffer.from('file'));
  });
});

function file(overrides: Partial<UploadedFile> = {}): UploadedFile {
  return {
    buffer: Buffer.from('file'),
    mimetype: 'image/png',
    originalname: 'file.png',
    size: overrides.size ?? 4,
    ...overrides,
  };
}

function restoreEnv(key: 'PUBLIC_UPLOAD_BASE_URL' | 'UPLOAD_DIR', value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
