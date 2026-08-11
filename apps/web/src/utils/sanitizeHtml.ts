const allowedTags = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'EM',
  'FIGCAPTION',
  'FIGURE',
  'H2',
  'H3',
  'H4',
  'HR',
  'I',
  'IMG',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'STRONG',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'U',
  'UL',
]);

const removeWithContentTags = new Set([
  'BASE',
  'BUTTON',
  'EMBED',
  'FORM',
  'IFRAME',
  'INPUT',
  'LINK',
  'MATH',
  'META',
  'NOSCRIPT',
  'OBJECT',
  'SCRIPT',
  'SELECT',
  'STYLE',
  'SVG',
  'TEMPLATE',
  'TEXTAREA',
]);

const safeImageDataPattern = /^data:image\/(?:gif|jpeg|png|webp);base64,/i;

export function sanitizeRichHtml(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  if (typeof DOMParser === 'undefined') {
    return escapeHtml(value);
  }

  const document = new DOMParser().parseFromString(value, 'text/html');
  const elements = Array.from(document.body.querySelectorAll('*'));

  elements.forEach((element) => {
    if (removeWithContentTags.has(element.tagName)) {
      element.remove();
      return;
    }

    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    sanitizeAttributes(element);
  });

  return document.body.innerHTML;
}

function sanitizeAttributes(element: Element) {
  const allowedAttributes = resolveAllowedAttributes(element.tagName);

  Array.from(element.attributes).forEach((attribute) => {
    if (!allowedAttributes.has(attribute.name.toLowerCase())) {
      element.removeAttribute(attribute.name);
    }
  });

  if (element.tagName === 'A') {
    sanitizeAnchor(element);
  }

  if (element.tagName === 'IMG') {
    sanitizeImage(element);
  }

  if (element.tagName === 'OL') {
    sanitizeIntegerAttribute(element, 'start');
  }

  if (element.tagName === 'TD' || element.tagName === 'TH') {
    sanitizeIntegerAttribute(element, 'colspan');
    sanitizeIntegerAttribute(element, 'rowspan');
  }
}

function resolveAllowedAttributes(tagName: string) {
  if (tagName === 'A') {
    return new Set(['href', 'target', 'title']);
  }

  if (tagName === 'IMG') {
    return new Set(['alt', 'height', 'loading', 'src', 'title', 'width']);
  }

  if (tagName === 'OL') {
    return new Set(['start']);
  }

  if (tagName === 'TD' || tagName === 'TH') {
    return new Set(['colspan', 'rowspan', 'scope']);
  }

  return new Set(['title']);
}

function sanitizeAnchor(element: Element) {
  const href = element.getAttribute('href');

  if (!href || !isSafeUrl(href, false)) {
    element.removeAttribute('href');
    element.removeAttribute('target');
    return;
  }

  const target = element.getAttribute('target');
  if (target !== '_blank' && target !== '_self') {
    element.removeAttribute('target');
  }

  if (target === '_blank') {
    element.setAttribute('rel', 'noopener noreferrer');
  }
}

function sanitizeImage(element: Element) {
  const src = element.getAttribute('src');

  if (!src || !isSafeUrl(src, true)) {
    element.removeAttribute('src');
  }

  const loading = element.getAttribute('loading');
  if (loading !== 'eager' && loading !== 'lazy') {
    element.removeAttribute('loading');
  }

  sanitizeIntegerAttribute(element, 'height');
  sanitizeIntegerAttribute(element, 'width');
}

function isSafeUrl(value: string, allowImageData: boolean) {
  const normalized = Array.from(value)
    .filter((character) => character.charCodeAt(0) > 32)
    .join('')
    .toLowerCase();

  if (allowImageData && safeImageDataPattern.test(normalized)) {
    return true;
  }

  if (normalized.startsWith('#')) {
    return true;
  }

  try {
    const url = new URL(value, window.location.origin);
    return allowImageData
      ? ['http:', 'https:'].includes(url.protocol)
      : ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function sanitizeIntegerAttribute(element: Element, name: string) {
  const value = element.getAttribute(name);

  if (!value || !/^\d{1,4}$/.test(value) || Number(value) < 1) {
    element.removeAttribute(name);
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
