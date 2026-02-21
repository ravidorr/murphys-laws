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
});
