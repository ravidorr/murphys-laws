import { NotFound } from '../src/views/not-found.js';

describe('NotFound view', () => {
  it('renders heading and message', () => {
    const el = NotFound({ onNavigate: () => {} });

    expect(el.textContent).toMatch(/Page Not Found/i);
    expect(el.textContent).toMatch(/could not be found/i);
  });

  it('navigates back home when button is clicked', () => {
    const onNavigate = vi.fn();
    const el = NotFound({ onNavigate });

    const btn = el.querySelector('[data-nav="home"]');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('does not navigate when navTarget is missing', () => {
    const onNavigate = vi.fn();
    const el = NotFound({ onNavigate });

    // Create a nav button without data-nav attribute
    const fakeNavBtn = document.createElement('button');
    fakeNavBtn.setAttribute('data-nav', ''); // Empty nav target
    el.appendChild(fakeNavBtn);

    fakeNavBtn.click();

    // Should not call onNavigate when navTarget is empty
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('handles non-HTMLElement targets gracefully', () => {
    const onNavigate = vi.fn();
    const el = NotFound({ onNavigate });

    // Create a text node (not an HTMLElement)
    const textNode = document.createTextNode('some text');
    el.appendChild(textNode);

    // Simulate click event with text node as target
    const event = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: textNode });
    el.dispatchEvent(event);

    // Should not call onNavigate for non-HTMLElement
    expect(onNavigate).not.toHaveBeenCalled();
  });

});
