import { apiRequest, setUnauthorizedHandler } from '../services/request';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

describe('apiRequest', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses api base path, includes cookie credentials and parses json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ username: 'admin' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/auth/me')).resolves.toEqual({ username: 'admin' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      }),
    );
  });

  it('calls unauthorized handler and throws ApiError on 401', async () => {
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: '未登录' }, { status: 401 })));

    await expect(apiRequest('/auth/me')).rejects.toMatchObject({
      message: '未登录',
      status: 401,
    });
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});
