import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import PhotoManageView from '../views/PhotoManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  });
}

function albumsPayload() {
  return [
    {
      coverUrl: null,
      description: null,
      id: 1,
      isEnabled: true,
      name: '春日',
      slug: 'spring',
      sortOrder: 0,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    },
  ];
}

function albumListPayload() {
  return {
    items: albumsPayload(),
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

function photosPayload() {
  return {
    items: [
      {
        album: { id: 1, name: '春日', slug: 'spring' },
        albumId: 1,
        description: null,
        id: 1,
        largeUrl: '/large.jpg',
        likeCount: 0,
        liked: false,
        originalUrl: '/original.jpg',
        sortOrder: 0,
        status: 'PUBLISHED',
        thumbUrl: '/thumb.jpg',
        title: '旧照片',
        visibility: 'PUBLIC',
      },
      {
        album: { id: 1, name: '春日', slug: 'spring' },
        albumId: 1,
        description: null,
        id: 2,
        largeUrl: '/large-2.jpg',
        likeCount: 0,
        liked: false,
        originalUrl: '/original-2.jpg',
        sortOrder: 1,
        status: 'PUBLISHED',
        thumbUrl: '/thumb-2.jpg',
        title: '第二张',
        visibility: 'PUBLIC',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

describe('PhotoManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads photos/albums and submits photo and album forms', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/photos' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 2 }));
      }
      if (url === '/api/admin/uploads/photo' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            kind: 'photo',
            large: { url: '/uploads/photos/large/new.jpg' },
            original: { url: '/uploads/photos/original/new.jpg' },
            thumb: { url: '/uploads/photos/thumb/new.jpg' },
          }),
        );
      }
      if (url === '/api/admin/photos/sort' && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      if (url === '/api/admin/albums' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 3 }));
      }
      if (typeof url === 'string' && url.startsWith('/api/admin/albums?')) {
        return Promise.resolve(jsonResponse(albumListPayload()));
      }
      if (url === '/api/admin/albums' && init?.method === 'GET') {
        return Promise.resolve(jsonResponse(albumListPayload()));
      }

      return Promise.resolve(jsonResponse(photosPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(PhotoManageView, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/photos?page=1&pageSize=10',
      expect.any(Object),
    );
    expect(wrapper.text()).toContain('旧照片');

    const dataTransfer = { effectAllowed: '', setData: vi.fn() };
    const dragHandles = wrapper.findAll('.photo-drag-handle');
    await dragHandles[0].trigger('dragstart', { dataTransfer });
    await dragHandles[1].trigger('drop');
    await flushPromises();

    expect(
      JSON.parse(
        fetchMock.mock.calls.find(
          ([url, init]) => url === '/api/admin/photos/sort' && init?.method === 'PUT',
        )?.[1]?.body as string,
      ),
    ).toEqual({
      items: [
        { id: 2, sortOrder: 0 },
        { id: 1, sortOrder: 1 },
      ],
    });

    const vm = wrapper.vm as unknown as {
      albumForm: { name: string; slug: string };
      handleSubmitAlbum: () => Promise<void>;
      handleSubmitPhoto: () => Promise<void>;
      openCreateAlbumDialog: () => void;
      openCreatePhotoDialog: () => void;
      photoForm: { largeUrl: string; originalUrl: string; thumbUrl: string; title: string };
    };
    vm.openCreatePhotoDialog();
    await flushPromises();

    const fileInputs = wrapper.findAll('input[type="file"]');
    expect(fileInputs).toHaveLength(2);
    const dialogFileInput = fileInputs[1];
    const file = new File(['photo'], 'window-light.jpg', { type: 'image/jpeg' });
    Object.defineProperty(dialogFileInput.element, 'files', { configurable: true, value: [file] });
    await dialogFileInput.trigger('change');
    await flushPromises();

    expect(vm.photoForm).toMatchObject({
      largeUrl: '/uploads/photos/large/new.jpg',
      originalUrl: '/uploads/photos/original/new.jpg',
      thumbUrl: '/uploads/photos/thumb/new.jpg',
      title: 'window-light',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/uploads/photo',
      expect.objectContaining({ body: expect.any(FormData), method: 'POST' }),
    );

    vm.photoForm.title = '新照片';
    await vm.handleSubmitPhoto();
    await flushPromises();

    expect(
      JSON.parse(
        fetchMock.mock.calls.find(
          ([url, init]) => url === '/api/admin/photos' && init?.method === 'POST',
        )?.[1]?.body as string,
      ),
    ).toMatchObject({
      originalUrl: '/uploads/photos/original/new.jpg',
      title: '新照片',
    });

    vm.openCreateAlbumDialog();
    vm.albumForm.name = '新相册';
    vm.albumForm.slug = 'new-album';
    await vm.handleSubmitAlbum();
    await flushPromises();

    expect(
      JSON.parse(
        fetchMock.mock.calls.find(
          ([url, init]) => url === '/api/admin/albums' && init?.method === 'POST',
        )?.[1]?.body as string,
      ),
    ).toMatchObject({
      name: '新相册',
      slug: 'new-album',
    });
  });
});
