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

/** Resolve a panel action through its centrally owned semantic icon role. */
export function createPanelControlIcon(control, ownerDocument = globalThis.document) {
  const definition = iconLibrary.panelControls?.[control]
  if (!definition || typeof definition.icon !== 'string') throw new RangeError(`Unknown shared panel control: ${control}`)
  return createDesignIcon(definition.icon, ownerDocument)
}

/** Return the canonical accessible name for a semantic panel control role. */
export function getPanelControlLabel(control) {
  const label = iconLibrary.panelControls?.[control]?.label
  if (typeof label !== 'string') throw new RangeError(`Unknown shared panel control: ${control}`)
  return label
}

/** Apply one canonical icon, accessible name and title to an existing panel button. */
export function applyPanelControl(button, control) {
  const definition = iconLibrary.panelControls?.[control]
  if (!definition || typeof definition.icon !== 'string' || typeof definition.label !== 'string') {
    throw new RangeError(`Unknown shared panel control: ${control}`)
  }
  if (!button || button.localName !== 'button' || !button.ownerDocument?.createElementNS) {
    throw new TypeError('A panel control must be a button in an owner document')
  }
  const existingControl = button.dataset.agenticPanelControl
  if (existingControl && existingControl !== control) {
    throw new TypeError(`Panel control cannot replace its existing semantic role: ${existingControl}`)
  }
  for (const attribute of ['aria-label', 'title']) {
    const existing = button.getAttribute(attribute)
    if (button.hasAttribute(attribute) && existing !== definition.label) {
      throw new TypeError(`Panel control ${control} cannot override its canonical ${attribute}`)
    }
  }
  if (button.hasAttribute('aria-labelledby') || (control !== 'pin' && button.hasAttribute('aria-pressed'))) {
    throw new TypeError(`Panel control ${control} cannot override its canonical accessible state`)
  }
  button.type = 'button'
  button.dataset.agenticPanelControl = control
  button.setAttribute('aria-label', definition.label)
  button.title = definition.label
  button.classList.add('agentic-toolbar-item')
  button.dataset.iconOnly = ''
  if (control === 'close') button.classList.add('agentic-base-floating-panel-close')
  button.replaceChildren(createPanelControlIcon(control, button.ownerDocument))
  return button
}

/** Render one icon-only button from the semantic panel-control registry. */
export function createPanelControlButton(control, ownerDocument = globalThis.document) {
  if (!ownerDocument?.createElement) throw new TypeError('An owner document is required to create a panel control')
  return applyPanelControl(ownerDocument.createElement('button'), control)
}

/** Hydrate role-marked buttons from the one panel-control registry. */
export function hydratePanelControls(root = globalThis.document) {
  if (!root?.querySelectorAll) throw new TypeError('A panel control hydration root is required')
  const buttons = [...root.querySelectorAll('[data-agentic-panel-control]')]
  for (const button of buttons) applyPanelControl(button, button.dataset.agenticPanelControl)
  return buttons.length
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
