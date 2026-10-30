// DOM method polyfills for older browsers (for example the Kindle browser). The legacy build
// transpiles syntax and polyfills JavaScript built-ins, but not DOM methods, so a missing one
// would throw while the router has already cleared the static shell and leave a blank page.

type NodeOrText = Node | string;

function toNode(doc: Document, item: NodeOrText): Node {
  return typeof item === 'string' ? doc.createTextNode(item) : item;
}

function toFragment(doc: Document, items: NodeOrText[]): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  items.forEach((item) => fragment.appendChild(toNode(doc, item)));
  return fragment;
}

function defineIfMissing(target: object, name: string, value: unknown): void {
  if (name in target) return;
  Object.defineProperty(target, name, { value, writable: true, configurable: true });
}

export function installLegacyPolyfills(): void {
  function replaceChildren(this: Node, ...items: NodeOrText[]): void {
    while (this.firstChild) this.removeChild(this.firstChild);
    this.appendChild(toFragment(this.ownerDocument ?? (this as Document), items));
  }
  [Element.prototype, Document.prototype, DocumentFragment.prototype].forEach((proto) => {
    defineIfMissing(proto, 'replaceChildren', replaceChildren);
  });

  function append(this: Node, ...items: NodeOrText[]): void {
    this.appendChild(toFragment(this.ownerDocument ?? (this as Document), items));
  }
  [Element.prototype, Document.prototype, DocumentFragment.prototype].forEach((proto) => {
    defineIfMissing(proto, 'append', append);
  });

  function replaceWith(this: ChildNode, ...items: NodeOrText[]): void {
    const parent = this.parentNode;
    if (!parent) return;
    parent.replaceChild(toFragment(this.ownerDocument!, items), this);
  }
  function after(this: ChildNode, ...items: NodeOrText[]): void {
    const parent = this.parentNode;
    if (!parent) return;
    parent.insertBefore(toFragment(this.ownerDocument!, items), this.nextSibling);
  }
  [Element.prototype, CharacterData.prototype].forEach((proto) => {
    defineIfMissing(proto, 'replaceWith', replaceWith);
    defineIfMissing(proto, 'after', after);
  });

  defineIfMissing(Element.prototype, 'toggleAttribute', function toggleAttribute(this: Element, name: string, force?: boolean): boolean {
    const shouldHave = force === undefined ? !this.hasAttribute(name) : force;
    if (shouldHave) this.setAttribute(name, '');
    else this.removeAttribute(name);
    return shouldHave;
  });
}
