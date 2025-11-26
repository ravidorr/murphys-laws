import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initAdSense } from '../src/utils/ads.js';

describe('initAdSense', () => {
    beforeEach(() => {
        // Clear head before each test
        document.head.innerHTML = '';
        // Mock console.warn to keep output clean
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should inject the AdSense script into the head', () => {
        initAdSense();

        const script = document.head.querySelector('script[src*="adsbygoogle"]');
        expect(script).toBeTruthy();
        expect(script.src).toContain('client=ca-pub-3615614508734124');
        expect(script.async).toBe(true);
        expect(script.crossOrigin).toBe('anonymous');
    });

    it('should not inject the script if it already exists', () => {
        // Call it once
        initAdSense();
        expect(document.head.querySelectorAll('script').length).toBe(1);

        // Call it again
        initAdSense();
        expect(document.head.querySelectorAll('script').length).toBe(1);
    });

    it('should not inject if window.adsbygoogle is already defined', () => {
        window.adsbygoogle = {};
        initAdSense();
        expect(document.head.querySelectorAll('script').length).toBe(0);
        delete window.adsbygoogle;
    });
});
