import { describe, it, expect, afterEach } from 'vitest';
import { installLegacyPolyfills } from '../src/utils/legacy-polyfills.ts';

type Proto = Record<string, unknown>;

const protos: Array<[string, Proto]> = [
  ['Element', Element.prototype as unknown as Proto],
  ['Document', Document.prototype as unknown as Proto],
  ['DocumentFragment', DocumentFragment.prototype as unknown as Proto],
  ['CharacterData', CharacterData.prototype as unknown as Proto],
];
const names = ['replaceChildren', 'append', 'replaceWith', 'after', 'toggleAttribute'];

const saved = protos.flatMap(([label, proto]) => names
  .filter((name) => Object.prototype.hasOwnProperty.call(proto, name))
  .map((name) => ({ label, proto, name, descriptor: Object.getOwnPropertyDescriptor(proto, name)! })));

function removeNative(): void {
  saved.forEach(({ proto, name }) => { delete proto[name]; });
}

describe('legacy polyfills', () => {
  afterEach(() => {
    saved.forEach(({ proto, name, descriptor }) => Object.defineProperty(proto, name, descriptor));
  });

  it('leaves native implementations alone', () => {
    const before = Element.prototype.replaceChildren;
    installLegacyPolyfills();
    expect(Element.prototype.replaceChildren).toBe(before);
  });

  it('polyfills replaceChildren on elements, documents, and fragments', () => {
    removeNative();
    installLegacyPolyfills();

    const el = document.createElement('div');
    el.innerHTML = '<p>old</p><p>older</p>';
    const next = document.createElement('span');
    el.replaceChildren(next, 'text');
    expect(el.childNodes).toHaveLength(2);
    expect(el.firstChild).toBe(next);
    expect(el.lastChild?.textContent).toBe('text');

    el.replaceChildren();
    expect(el.childNodes).toHaveLength(0);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createElement('i'));
    fragment.replaceChildren('only');
    expect(fragment.textContent).toBe('only');

    const doc = document.implementation.createHTMLDocument('x');
    doc.replaceChildren(doc.createElement('html'));
    expect(doc.documentElement.tagName).toBe('HTML');
  });

  it('polyfills append on elements, fragments, and documents', () => {
    removeNative();
    installLegacyPolyfills();

    const el = document.createElement('div');
    el.append(document.createElement('b'), 'tail');
    expect(el.innerHTML).toBe('<b></b>tail');

    const fragment = document.createDocumentFragment();
    fragment.append('x');
    expect(fragment.textContent).toBe('x');

    const doc = document.implementation.createHTMLDocument('x');
    doc.documentElement.remove();
    doc.append(doc.createElement('html'));
    expect(doc.documentElement.tagName).toBe('HTML');
  });

  it('polyfills replaceWith and after for elements and text nodes', () => {
    removeNative();
    installLegacyPolyfills();

    const parent = document.createElement('div');
    parent.innerHTML = '<b id="a"></b><b id="b"></b>';
    const a = parent.querySelector('#a')!;
    const b = parent.querySelector('#b')!;

    a.replaceWith(document.createElement('u'), 'mid');
    expect(parent.innerHTML).toBe('<u></u>mid<b id="b"></b>');

    b.after('tail');
    expect(parent.innerHTML).toBe('<u></u>mid<b id="b"></b>tail');

    const text = parent.lastChild as CharacterData;
    text.after(document.createElement('s'));
    text.replaceWith('done');
    expect(parent.innerHTML).toBe('<u></u>mid<b id="b"></b>done<s></s>');
  });

  it('does nothing for replaceWith and after on detached nodes', () => {
    removeNative();
    installLegacyPolyfills();

    const detached = document.createElement('div');
    expect(() => detached.replaceWith('x')).not.toThrow();
    expect(() => detached.after('x')).not.toThrow();
  });

  it('polyfills toggleAttribute with and without force', () => {
    removeNative();
    installLegacyPolyfills();

    const el = document.createElement('div');
    expect(el.toggleAttribute('hidden')).toBe(true);
    expect(el.hasAttribute('hidden')).toBe(true);
    expect(el.toggleAttribute('hidden')).toBe(false);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.toggleAttribute('hidden', true)).toBe(true);
    expect(el.toggleAttribute('hidden', true)).toBe(true);
    expect(el.toggleAttribute('hidden', false)).toBe(false);
    expect(el.hasAttribute('hidden')).toBe(false);
  });
});
