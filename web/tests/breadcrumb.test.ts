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

  it('L37 B1: appends separator after Home when items.length > 0', () => {
    const el = Breadcrumb({
      items: [{ label: 'Only', href: '/' }],
      onNavigate: () => {}
    });
    const firstLi = el.querySelector('.breadcrumb-list .breadcrumb-item');
    expect(firstLi).toBeTruthy();
    const sep = firstLi!.querySelector('.breadcrumb-separator');
    expect(sep).toBeTruthy();
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
