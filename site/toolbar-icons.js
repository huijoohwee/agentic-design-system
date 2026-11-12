import iconLibrary from './icons.json' with { type: 'json' }

/** Props shared by React and native, icon-only toolbar and floating buttons. */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const SHARED_ICON_TAGS = new Set(['circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect'])

/** Render one icon from the central Design System registry. */
export function createDesignIcon(name, ownerDocument = globalThis.document) {
  const nodes = iconLibrary.icons[name]
  if (!Array.isArray(nodes)) throw new RangeError(`Unknown shared icon: ${name}`)
  if (!ownerDocument?.createElementNS) throw new TypeError('An owner document is required to create an icon')

  const icon = ownerDocument.createElementNS(SVG_NAMESPACE, 'svg')
  for (const [attribute, value] of Object.entries({
    viewBox: iconLibrary.viewBox,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: 'agentic-icon',
    'aria-hidden': 'true',
    focusable: 'false',
  })) icon.setAttribute(attribute, value)

  for (const [tag, attributes] of nodes) {
    if (!SHARED_ICON_TAGS.has(tag)) throw new TypeError(`Unsupported shared icon node: ${tag}`)
    const node = ownerDocument.createElementNS(SVG_NAMESPACE, tag)
    for (const [attribute, value] of Object.entries(attributes)) node.setAttribute(attribute, String(value))
    icon.append(node)
  }
  return icon
}

/** Hydrate declarative icon placeholders without copying SVG paths into consumers. */
export function hydrateDesignIcons(root = globalThis.document) {
  if (!root?.querySelectorAll) throw new TypeError('An icon hydration root is required')
  const placeholders = [...root.querySelectorAll('[data-agentic-design-icon]')]
  for (const placeholder of placeholders) {
    const icon = createDesignIcon(placeholder.getAttribute('data-agentic-design-icon'), placeholder.ownerDocument)
    const className = placeholder.getAttribute('class')
    if (className) icon.setAttribute('class', className)
    placeholder.replaceWith(icon)
  }
  return placeholders.length
}

export function getIconButtonProps(label) {
  return {
    type: 'button',
    className: 'agentic-toolbar-item',
    'data-icon-only': '',
    'aria-label': label,
  };
}

export function getIconSizeClass(scale = 'default') {
  return scale === 'compact' ? 'agentic-icon agentic-icon-compact' : 'agentic-icon';
}

export function createIconButton(label, glyph) {
  const button = glyph.ownerDocument.createElement('button');
  const { className, ...attributes } = getIconButtonProps(label);
  button.className = className;
  for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value);
  glyph.setAttribute('class', getIconSizeClass());
  glyph.setAttribute('role', 'img');
  glyph.setAttribute('aria-label', `${label} icon`);
  glyph.setAttribute('focusable', 'false');
  glyph.setAttribute('stroke', 'currentColor');
  glyph.setAttribute('fill', 'none');
  button.append(glyph);
  return button;
}
