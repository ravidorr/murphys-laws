import { createCanvas, loadImage } from 'canvas';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the logo icon
// Try production path first (web/dist/), then development path (web/public/)
const LOGO_FILENAME = 'android-chrome-192x192.png';
const PROD_LOGO_PATH = resolve(__dirname, '../../../web/dist', LOGO_FILENAME);
const DEV_LOGO_PATH = resolve(__dirname, '../../../web/public', LOGO_FILENAME);
const LOGO_PATH = existsSync(PROD_LOGO_PATH) ? PROD_LOGO_PATH : DEV_LOGO_PATH;

// Image dimensions (standard OG image size)
const WIDTH = 1200;
const HEIGHT = 630;

// Design constants
const PADDING = 60;
const MAX_TEXT_WIDTH = WIDTH - (PADDING * 2);

// Colors
const COLORS = {
  background: '#0b0b11',         // Dark background (matches dark theme)
  gradientStart: '#1a1a2e',      // Subtle gradient
  gradientEnd: '#0b0b11',
  primaryText: '#e9eaee',        // Light text
  secondaryText: '#b3b7c4',      // Muted text
  accent: '#4f46e5',             // Indigo accent
  accentLight: '#6366f1',
};

// Font configuration
const FONTS = {
  title: 'bold 42px "Work Sans", sans-serif',
  lawText: '32px "Work Sans", sans-serif',
  attribution: 'italic 24px "Work Sans", sans-serif',
  branding: 'bold 28px "Work Sans", sans-serif',
  url: '20px "Work Sans", sans-serif',
};

export interface IOgImageLawService {
  getLaw(id: number): Promise<{ id: number; title?: string | null; text: string; attributions?: Array<{ name: string }> } | null>;
}

export interface OgImageServiceOptions {
  cacheMaxAge?: number;
  cacheMaxSize?: number;
  logoPath?: string;
}

/**
 * OG Image generation service
 * Creates Open Graph images for social sharing
 *
 * Features:
 * - In-memory caching with configurable TTL and max size
 * - LRU-style eviction (oldest entries removed first)
 * - Cache statistics for monitoring
 */
export class OgImageService {
  private lawService: IOgImageLawService;
  private cache: Map<number, { buffer: Buffer; timestamp: number }>;
  private cacheMaxAge: number;
  private cacheMaxSize: number;
  private logo: Awaited<ReturnType<typeof loadImage>> | null;
  private logoLoaded: boolean;
  private logoPath: string;
  private stats: { hits: number; misses: number; evictions: number };

  constructor(lawService: IOgImageLawService, options: OgImageServiceOptions = {}) {
    this.lawService = lawService;
    this.cache = new Map();
    this.cacheMaxAge = options.cacheMaxAge ?? 24 * 60 * 60 * 1000; // 24 hours default
    this.cacheMaxSize = options.cacheMaxSize ?? 500; // Max 500 cached images (~500MB at ~1MB each)

    this.logo = null;
    this.logoLoaded = false;
    this.logoPath = options.logoPath ?? LOGO_PATH;

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Load the logo image (called once, cached)
   * @returns {Promise<Image|null>} The loaded image or null if failed
   */
  async loadLogo() {
    if (this.logoLoaded) {
      return this.logo;
    }
    
    try {
      this.logo = await loadImage(this.logoPath);
      this.logoLoaded = true;
    } catch (error: unknown) {
      console.warn('Could not load logo image:', error instanceof Error ? error.message : String(error));
      this.logo = null;
      this.logoLoaded = true;
    }
    
    return this.logo;
  }

  /**
   * Generate an OG image for a specific law
   * @param {number} lawId - The law ID
   * @returns {Promise<Buffer|null>} PNG image buffer or null if law not found
   */
  async generateLawImage(lawId: number): Promise<Buffer | null> {
    // Check cache first
    const cached = this.cache.get(lawId);
    if (cached && (Date.now() - cached.timestamp) < this.cacheMaxAge) {
      this.stats.hits++;
      // Move to end for LRU ordering (Map preserves insertion order)
      this.cache.delete(lawId);
      this.cache.set(lawId, cached);
      return cached.buffer;
    }
    
    this.stats.misses++;

    // Fetch the law
    const law = await this.lawService.getLaw(lawId);
    if (!law) {
      return null;
    }

    // Load logo if not already loaded
    const logo = await this.loadLogo();

    // Generate the image
    const buffer = this.renderLawImage(law, logo ?? undefined);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value as number | undefined;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
        this.stats.evictions++;
      }
    }

    // Cache the result
    this.cache.set(lawId, {
      buffer,
      timestamp: Date.now(),
    });

    return buffer;
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) + '%' : 'N/A',
      evictions: this.stats.evictions,
    };
  }

  /**
   * Render the OG image for a law
   * @param {Object} law - Law object with id, title, text, attributions
   * @param {Image|null} logo - Logo image to draw (optional)
   * @returns {Buffer} PNG image buffer
   */
  renderLawImage(law: { id: number; title?: string | null; text: string; attributions?: Array<{ name: string }> }, logo?: Awaited<ReturnType<typeof loadImage>> | null): Buffer {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // Draw background gradient
    this.drawBackground(ctx);

    // Draw decorative elements
    this.drawDecorations(ctx);

    // Draw the law content
    this.drawLawContent(ctx, law);

    // Draw branding with logo
    this.drawBranding(ctx, logo ?? null);

    return canvas.toBuffer('image/png');
  }

  /**
   * Draw the background gradient
   */
  drawBackground(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, COLORS.gradientStart);
    gradient.addColorStop(1, COLORS.gradientEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  /**
   * Draw decorative elements
   */
  drawDecorations(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>): void {
    // Accent line at top
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(0, 0, WIDTH, 6);

    // Subtle corner accents
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(PADDING, PADDING + 60);
    ctx.lineTo(PADDING, PADDING);
    ctx.lineTo(PADDING + 60, PADDING);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(WIDTH - PADDING, HEIGHT - PADDING - 60);
    ctx.lineTo(WIDTH - PADDING, HEIGHT - PADDING);
    ctx.lineTo(WIDTH - PADDING - 60, HEIGHT - PADDING);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  /**
   * Draw the law content (title, text, attribution)
   */
  drawLawContent(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, law: { id: number; title?: string | null; text: string; attributions?: Array<{ name: string }> }): void {
    let yPosition = 80;

    // Draw title if present
    if (law.title) {
      ctx.font = FONTS.title;
      ctx.fillStyle = COLORS.accent;
      
      const title = this.truncateText(ctx, law.title, MAX_TEXT_WIDTH);
      ctx.fillText(title, PADDING, yPosition);
      yPosition += 60;
    }

    // Draw quotation marks
    ctx.font = 'bold 80px Georgia, serif';
    ctx.fillStyle = COLORS.accent;
    ctx.globalAlpha = 0.4;
    ctx.fillText('"', PADDING - 10, yPosition + 40);
    ctx.globalAlpha = 1;

    // Draw law text
    ctx.font = FONTS.lawText;
    ctx.fillStyle = COLORS.primaryText;
    
    const maxLawTextHeight = 320; // Max height for law text
    const lines = this.wrapText(ctx, law.text || '', MAX_TEXT_WIDTH - 40);
    const lineHeight = 44;
    
    // Calculate how many lines we can fit
    const maxLines = Math.floor(maxLawTextHeight / lineHeight);
    const displayLines = lines.slice(0, maxLines);
    
    // If text is truncated, add ellipsis to last line
    if (lines.length > maxLines) {
      const lastLine = displayLines[displayLines.length - 1];
      displayLines[displayLines.length - 1] = this.truncateText(ctx, lastLine, MAX_TEXT_WIDTH - 80) + '...';
    }

    yPosition += 20;
    for (const line of displayLines) {
      ctx.fillText(line, PADDING + 30, yPosition);
      yPosition += lineHeight;
    }

    // Draw attribution if present
    const attributionName = this.getAttributionName(law);
    if (attributionName) {
      ctx.font = FONTS.attribution;
      ctx.fillStyle = COLORS.secondaryText;
      const attribution = `- ${attributionName}`;
      ctx.fillText(attribution, PADDING + 30, yPosition + 20);
    }
  }

  /**
   * Draw branding elements
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Image|null} logo - Logo image to draw (optional)
   */
  drawBranding(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, logo: Awaited<ReturnType<typeof loadImage>> | null = null): void {
    const brandingY = HEIGHT - 50;
    const logoSize = 40; // Size to draw the logo
    let textStartX = PADDING;

    // Draw logo if available
    if (logo) {
      const logoY = brandingY - logoSize + 10; // Align with text baseline
      ctx.drawImage(logo, PADDING, logoY, logoSize, logoSize);
      textStartX = PADDING + logoSize + 12; // Space after logo
    }

    // Murphy's Laws text
    ctx.font = FONTS.branding;
    ctx.fillStyle = COLORS.primaryText;
    ctx.fillText("Murphy's Laws", textStartX, brandingY);

    // Site URL
    ctx.font = FONTS.url;
    ctx.fillStyle = COLORS.secondaryText;
    ctx.fillText('murphys-laws.com', WIDTH - PADDING - 150, brandingY);
  }

  /**
   * Wrap text to fit within a maximum width
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} text - Text to wrap
   * @param {number} maxWidth - Maximum width in pixels
   * @returns {string[]} Array of lines
   */
  wrapText(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Truncate text to fit within a maximum width, adding ellipsis
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} text - Text to truncate
   * @param {number} maxWidth - Maximum width in pixels
   * @returns {string} Truncated text
   */
  truncateText(ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>, text: string, maxWidth: number): string {
    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) {
      return text;
    }

    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }

  /**
   * Get the attribution name from a law's attributions
   * @param {Object} law - Law object
   * @returns {string|null} Attribution name or null
   */
  getAttributionName(law: { attributions?: Array<{ name?: string }> }): string | null {
    if (!law.attributions || !Array.isArray(law.attributions) || law.attributions.length === 0) {
      return null;
    }
    return law.attributions[0].name || null;
  }

  /**
   * Clean up expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheMaxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache
   */
  clearCache() {
    this.cache.clear();
  }
}
