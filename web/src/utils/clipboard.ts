import { showSuccess } from '../components/notification.ts';

/**
 * Copy text to clipboard with fallback for older browsers.
 * Shows a success notification on completion.
 */
export async function copyToClipboard(text: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showSuccess(successMessage);
  } catch {
    // Fallback using textarea for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showSuccess(successMessage);
  }
}
