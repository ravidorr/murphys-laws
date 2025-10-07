import { describe, it, expect, vi } from 'vitest';
import { Auth } from '../src/views/auth.js';

describe('Auth view', () => {
  it('renders login form when type is login', () => {
    const onNavigate = vi.fn();
    const onAuth = vi.fn();
    const el = Auth({ type: 'login', onNavigate, onAuth });

    expect(el.querySelector('h2').textContent).toBe('Log In');
    expect(el.querySelector('button[type="submit"]').textContent).toBe('Log In');
    expect(el.querySelector('input#username')).toBeTruthy();
    expect(el.querySelector('input#password')).toBeTruthy();
  });

  it('renders signup form when type is signup', () => {
    const onNavigate = vi.fn();
    const onAuth = vi.fn();
    const el = Auth({ type: 'signup', onNavigate, onAuth });

    expect(el.querySelector('h2').textContent).toBe('Sign Up');
    expect(el.querySelector('button[type="submit"]').textContent).toBe('Sign Up');
  });

  it('calls onAuth with username on form submit', () => {
    const onNavigate = vi.fn();
    const onAuth = vi.fn();
    const el = Auth({ type: 'login', onNavigate, onAuth });

    const usernameInput = el.querySelector('#username');
    usernameInput.value = 'testuser';

    const form = el.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(onAuth).toHaveBeenCalledWith('testuser');
  });

  it('uses default username "user" if input is empty', () => {
    const onNavigate = vi.fn();
    const onAuth = vi.fn();
    const el = Auth({ type: 'login', onNavigate, onAuth });

    const form = el.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(onAuth).toHaveBeenCalledWith('user');
  });

  it('trims whitespace from username', () => {
    const onNavigate = vi.fn();
    const onAuth = vi.fn();
    const el = Auth({ type: 'login', onNavigate, onAuth });

    const usernameInput = el.querySelector('#username');
    usernameInput.value = '  testuser  ';

    const form = el.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(onAuth).toHaveBeenCalledWith('testuser');
  });

  it('calls onNavigate when cancel button is clicked', () => {
    const onNavigate = vi.fn();
    const onAuth = vi.fn();
    const el = Auth({ type: 'login', onNavigate, onAuth });

    const cancelBtn = el.querySelector('button.outline');
    cancelBtn.click();

    expect(onNavigate).toHaveBeenCalledWith('home');
  });

  it('prevents default form submission', () => {
    const onNavigate = vi.fn();
    const onAuth = vi.fn();
    const el = Auth({ type: 'login', onNavigate, onAuth });

    const form = el.querySelector('form');
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(submitEvent, 'preventDefault');

    form.dispatchEvent(submitEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
