import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleNavClick,
  handleLawCardKeydown,
  addNavigationListener
} from '../src/utils/navigation.js';

interface NavContext {
  onNavigate?: (name: string, param?: string) => void;
  calls?: Array<{ name: string; param?: string }>;
}

function createLocalThis(): () => NavContext {
  const context: NavContext = {};

  beforeEach(() => {
    (Object.keys(context) as (keyof NavContext)[]).forEach((key) => {
      delete context[key];
    });
  });

  return () => context;
}

describe('navigation utils', () => {
  const local = createLocalThis();

  describe('handleNavClick', () => {
    it('returns false when target is not inside [data-nav]', () => {
      const ctx = local();
      ctx.onNavigate = () => {};
      const target = document.createElement('div');
      target.setAttribute('data-other', 'x');

      const result = handleNavClick(target, ctx.onNavigate);

      expect(result).toBe(false);
    });

    it('returns false when data-nav is empty string', () => {
      const ctx = local();
      ctx.onNavigate = () => {};
      const navBtn = document.createElement('a');
      navBtn.setAttribute('data-nav', '');
      const target = navBtn;

      const result = handleNavClick(target, ctx.onNavigate!);

      expect(result).toBe(false);
    });

    it('calls onNavigate with one arg when data-nav has no data-param', () => {
      const ctx = local();
      ctx.calls = [];
      const onNavigate = (name: string, param?: string) => {
        ctx.calls!.push({ name, param });
      };
      const navBtn = document.createElement('a');
      navBtn.setAttribute('data-nav', 'browse');
      const target = navBtn;

      const result = handleNavClick(target, onNavigate);

      expect(result).toBe(true);
      expect(ctx.calls).toHaveLength(1);
      expect(ctx.calls![0]).toEqual({ name: 'browse', param: undefined });
    });

    it('calls onNavigate with two args when data-nav and data-param are set', () => {
      const ctx = local();
      ctx.calls = [];
      const onNavigate = (name: string, param?: string) => {
        ctx.calls!.push({ name, param });
      };
      const navBtn = document.createElement('a');
      navBtn.setAttribute('data-nav', 'category');
      navBtn.setAttribute('data-param', 'science');
      const target = navBtn;

      const result = handleNavClick(target, onNavigate);

      expect(result).toBe(true);
      expect(ctx.calls).toHaveLength(1);
      expect(ctx.calls![0]).toEqual({ name: 'category', param: 'science' });
    });
  });

  describe('handleLawCardKeydown', () => {
    it('returns false when key is not Enter or Space', () => {
      const ctx = local();
      ctx.onNavigate = () => {};
      const e = new KeyboardEvent('keydown', { key: 'Tab' });
      const target = document.createElement('div');

      Object.defineProperty(e, 'target', { value: target, writable: false });
      const result = handleLawCardKeydown(e, ctx.onNavigate!);

      expect(result).toBe(false);
    });

    it('returns false when target is not an Element', () => {
      const ctx = local();
      ctx.onNavigate = () => {};
      const e = new KeyboardEvent('keydown', { key: 'Enter' });

      Object.defineProperty(e, 'target', { value: document.createTextNode('x'), writable: false });
      const result = handleLawCardKeydown(e, ctx.onNavigate!);

      expect(result).toBe(false);
    });

    it('returns false when target is not inside .law-card-mini', () => {
      const ctx = local();
      ctx.onNavigate = () => {};
      const e = new KeyboardEvent('keydown', { key: 'Enter' });
      const target = document.createElement('div');

      Object.defineProperty(e, 'target', { value: target, writable: false });
      const result = handleLawCardKeydown(e, ctx.onNavigate!);

      expect(result).toBe(false);
    });

    it('returns false when law-card-mini has no data-law-id', () => {
      const ctx = local();
      ctx.onNavigate = () => {};
      const card = document.createElement('div');
      card.className = 'law-card-mini';
      const target = card;
      const e = new KeyboardEvent('keydown', { key: 'Enter' });

      Object.defineProperty(e, 'target', { value: target, writable: false });
      const result = handleLawCardKeydown(e, ctx.onNavigate!);

      expect(result).toBe(false);
    });

    it('returns false when target is a button inside the card', () => {
      const ctx = local();
      ctx.onNavigate = () => {};
      const card = document.createElement('div');
      card.className = 'law-card-mini';
      card.dataset.lawId = '42';
      const btn = document.createElement('button');
      card.appendChild(btn);
      const e = new KeyboardEvent('keydown', { key: 'Enter' });

      Object.defineProperty(e, 'target', { value: btn, writable: false });
      const result = handleLawCardKeydown(e, ctx.onNavigate!);

      expect(result).toBe(false);
    });

    it('returns true and calls onNavigate when Enter on law-card-mini with lawId', () => {
      const ctx = local();
      ctx.calls = [];
      const onNavigate = (name: string, param?: string) => {
        ctx.calls!.push({ name, param });
      };
      const card = document.createElement('div');
      card.className = 'law-card-mini';
      card.dataset.lawId = '99';
      const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });

      Object.defineProperty(e, 'target', { value: card, writable: false });
      const result = handleLawCardKeydown(e, onNavigate);

      expect(result).toBe(true);
      expect(ctx.calls).toHaveLength(1);
      expect(ctx.calls![0]).toEqual({ name: 'law', param: '99' });
    });

    it('returns true and calls onNavigate when Space on law-card-mini', () => {
      const ctx = local();
      ctx.calls = [];
      const onNavigate = (name: string, param?: string) => {
        ctx.calls!.push({ name, param });
      };
      const card = document.createElement('div');
      card.className = 'law-card-mini';
      card.dataset.lawId = '1';
      const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true });

      Object.defineProperty(e, 'target', { value: card, writable: false });
      const result = handleLawCardKeydown(e, onNavigate);

      expect(result).toBe(true);
      expect(ctx.calls![0].param).toBe('1');
    });
  });

  describe('addNavigationListener', () => {
    it('adds keydown listener that delegates to handleLawCardKeydown', () => {
      const ctx = local();
      ctx.calls = [];
      const onNavigate = (name: string, param?: string) => {
        ctx.calls!.push({ name, param });
      };
      const el = document.createElement('div');
      const card = document.createElement('div');
      card.className = 'law-card-mini';
      card.dataset.lawId = '7';
      el.appendChild(card);

      addNavigationListener(el, onNavigate);
      const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      Object.defineProperty(e, 'target', { value: card, writable: false });
      el.dispatchEvent(e);

      expect(ctx.calls).toHaveLength(1);
      expect(ctx.calls![0].param).toBe('7');
    });
  });
});
