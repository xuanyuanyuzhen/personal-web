const PREVIEW_KEY = 'yuer.adminPreview';

export function readPreviewMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get('preview') ?? params.get('adminPreview');

  if (queryValue === 'admin' || queryValue === '1' || queryValue === 'true') {
    window.localStorage.setItem(PREVIEW_KEY, '1');
    return true;
  }

  if (queryValue === '0' || queryValue === 'false') {
    window.localStorage.removeItem(PREVIEW_KEY);
    return false;
  }

  return window.localStorage.getItem(PREVIEW_KEY) === '1';
}
