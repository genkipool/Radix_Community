import sanitizeHtmlLib from 'sanitize-html';

const defaultOptions: sanitizeHtmlLib.IOptions = {
  allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat([
    'img', 'svg', 'g', 'rect', 'circle', 'path', 'line', 'polygon', 'text', 'marker', 'defs', 'use', 'title', 'desc', 'foreignObject', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'pre'
  ]),
  allowedAttributes: {
    ...sanitizeHtmlLib.defaults.allowedAttributes,
    '*': ['class', 'id', 'style', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'x', 'y', 'r', 'cx', 'cy', 'transform', 'marker-end', 'marker-start', 'xmlns', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'rx', 'ry'],
    'a': ['href', 'name', 'target', 'rel'],
    'img': ['src', 'alt', 'title'],
  },
  allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'data'],
  // We need to allow SVG styles
  allowedStyles: {
    '*': {
      // allow all styles for mermaid and general components
      color: [/.*/],
      'background-color': [/.*/],
      'font-size': [/.*/],
      'font-family': [/.*/],
      'text-align': [/.*/],
    }
  }
};

export default function sanitizeHtml(html: string, options?: sanitizeHtmlLib.IOptions) {
  return sanitizeHtmlLib(html, { ...defaultOptions, ...options });
}
