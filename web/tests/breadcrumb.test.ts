import { describe, it, expect } from 'vitest';
import { Breadcrumb } from '../src/components/breadcrumb.ts';

describe('Breadcrumb component', () => {
  it('renders breadcrumb items and calls onNavigate when link is clicked', () => {
    let navigated = '';
    const el = Breadcrumb({
      items: [
        { label: 'Category', nav: 'category:general', href: '/category/general' },
        { label: 'Current' }
      ],
      onNavigate: (target) => { navigated = target; }
    });

    expect(el.querySelector('.breadcrumb-list')).toBeTruthy();
    const link = el.querySelector('[data-nav="category:general"]');
    expect(link).toBeTruthy();
    (link as HTMLElement).click();
    expect(navigated).toBe('category:general');
  });

  it('renders one separator before each item after Home (not after Home)', () => {
    const el = Breadcrumb({
      items: [{ label: 'Only', href: '/' }],
      onNavigate: () => {}
    });
    const items = el.querySelectorAll('.breadcrumb-item');
    expect(items.length).toBe(2);
    expect(items[0]!.querySelector('.breadcrumb-separator')).toBeNull();
    expect(items[1]!.querySelector('.breadcrumb-separator')).toBeTruthy();
  });

  it('does not render separators when items is empty', () => {
    const el = Breadcrumb({
      items: [],
      onNavigate: () => {}
    });
    const list = el.querySelector('.breadcrumb-list');
    const firstLi = list?.querySelector('.breadcrumb-item');
    expect(firstLi).toBeTruthy();
    const separators = firstLi!.querySelectorAll('.breadcrumb-separator');
    expect(separators.length).toBe(0);
  });

  it('sets data-param when item has param (L65)', () => {
    const el = Breadcrumb({
      items: [
        { label: 'Category', nav: 'category', param: 'tech-laws', href: '/category/tech-laws' },
        { label: 'Current' }
      ],
      onNavigate: () => {}
    });
    const link = el.querySelector('[data-nav="category"]');
    expect(link).toBeTruthy();
    expect(link!.getAttribute('data-param')).toBe('tech-laws');
  });
});
