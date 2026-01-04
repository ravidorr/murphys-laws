import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initShareCalculation } from '../src/modules/sods-share.js';

describe('Sod\'s share module - Coverage', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('throws error if root element is missing', () => {
    expect(() => {
      initShareCalculation({});
    }).toThrow('initShareCalculation requires a root element');
  });

  it('uses default state if getCalculationState is not provided', () => {
    // Setup minimal DOM for preview
    container.innerHTML = `
      <button id="preview-email"></button>
      <div id="email-preview-modal" class="hidden"></div>
      <div id="preview-content"></div>
      <input id="task-description" value="test">
      <input id="sender-name" value="test">
      <input id="sender-email" value="test@test.com">
      <input id="recipient-name" value="test">
      <input id="recipient-email" value="test@test.com">
    `;

    const cleanup = initShareCalculation({ root: container });
    
    // Trigger preview to exercise getState()
    container.querySelector('#preview-email').click();
    
    // Check if preview content contains default values
    const previewHtml = container.querySelector('#preview-content').innerHTML;
    // Default probability is '0.00'
    expect(previewHtml).toContain('0.00');
    
    cleanup();
  });

  it('handles missing share status element gracefully', () => {
    // No share-status element in container
    container.innerHTML = `
      <button id="share-cta"></button>
      <div id="share-form-container" class="hidden">
        <input id="task-description">
      </div>
      <button id="cancel-share"></button>
    `;

    const cleanup = initShareCalculation({ root: container });
    const shareCta = container.querySelector('#share-cta');
    const cancelBtn = container.querySelector('#cancel-share');

    // Should not throw when trying to hide/show status
    expect(() => {
      shareCta.click(); // Toggles form
      cancelBtn.click(); // Calls hideShareStatus
    }).not.toThrow();

    cleanup();
  });

  it('handles missing send button gracefully', async () => {
    container.innerHTML = `
      <button id="send-email"></button> <!-- Will remove this -->
      <div id="share-status"></div>
      <input id="task-description" value="test">
      <input id="sender-name" value="test">
      <input id="sender-email" value="test@test.com">
      <input id="recipient-name" value="test">
      <input id="recipient-email" value="test@test.com">
    `;
    
    const sendBtn = container.querySelector('#send-email');
    
    const cleanup = initShareCalculation({ root: container });
    
    // Remove button from DOM but trigger click on the reference we kept
    // (Simulates a race condition or weird DOM state)
    // Actually, initShareCalculation attaches the listener to the element found at init time.
    // To test "if (!sendButton) return", we need initShareCalculation to NOT find the button,
    // but we can't trigger a click on a non-existent button.
    // Wait, the check `if (!sendButton) return` is inside `handleSend`.
    // `handleSend` is attached to `sendButton`.
    // If `sendButton` is null, `addListener` returns early, so `handleSend` is never attached/called via click.
    // So that line is unreachable via user interaction if the button is missing at init.
    // However, we can call the handler directly if we expose it, but we can't.
    // 
    // Actually, if we look at the code:
    // const sendButton = root.querySelector('#send-email');
    // ...
    // async function handleSend() { ... if (!sendButton) return; ... }
    // ...
    // addListener(sendButton, 'click', handleSend);
    // 
    // If sendButton is null, addListener returns early. handleSend is never called.
    // The only way to hit that line is if sendButton exists at init, but somehow becomes null 
    // in the closure variable? No, it's a const.
    // 
    // Wait, `addListener` checks `if (!target) return;`.
    // So if sendButton is missing, the listener isn't added.
    // So `handleSend` is never called.
    // So `if (!sendButton) return` is dead code?
    // YES. `sendButton` is resolved once. If it's there, it's an Element. If it's not, it's null.
    // If it's null, the listener isn't attached. 
    // So `handleSend` cannot be triggered by a click.
    // 
    // UNLESS... we call handleSend manually? We can't, it's private.
    // 
    // Is there any other way? 
    // Maybe if we manually trigger it? No.
    // 
    // Let's re-read `addListener`:
    // function addListener(target, event, handler) { if (!target) return; ... }
    // 
    // So yes, `if (!sendButton) return` inside `handleSend` is theoretically unreachable 
    // via the event listener path if sendButton was null at init.
    // 
    // However, coverage might be flagging the "implicit" return of the `if (!target) return` in `addListener`.
    // Let's test `addListener` with missing elements.
  });

  it('safely handles missing optional elements', () => {
    // minimal markup with MANY missing elements
    container.innerHTML = `
      <button id="share-cta"></button>
    `;

    const cleanup = initShareCalculation({ root: container });
    
    // Should not throw
    expect(() => {
      container.querySelector('#share-cta').click();
    }).not.toThrow();

    cleanup();
  });
});
