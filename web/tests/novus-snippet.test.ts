import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(__dirname, '..');

function readNovusSnippet(): string {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? '');
  const snippet = scripts.find((script) => script.includes('cdn.pendo.io/agent/static/'));
  if (!snippet) {
    throw new Error('Novus agent snippet not found in index.html');
  }
  return snippet;
}

function readPendoAgentType(): string {
  return fs.readFileSync(path.join(root, 'src', 'types', 'global.d.ts'), 'utf8');
}

function runSnippetOnHost(hostname: string) {
  const insertBefore = vi.fn();
  const scriptElement: { async?: boolean; src?: string } = {};
  const fakeDocument = {
    createElement: vi.fn(() => scriptElement),
    getElementsByTagName: vi.fn(() => [{ parentNode: { insertBefore } }]),
  };
  const fakeWindow: { location: { hostname: string }; pendo?: unknown } = {
    location: { hostname },
  };

  new Function('window', 'document', readNovusSnippet())(fakeWindow, fakeDocument);

  return { insertBefore, scriptElement, fakeWindow };
}

describe('Novus agent snippet in index.html', () => {
  it('loads the agent and stubs window.pendo on the canonical production host', () => {
    const { insertBefore, scriptElement, fakeWindow } = runSnippetOnHost('murphys-laws.com');

    expect(insertBefore).toHaveBeenCalledTimes(1);
    expect(scriptElement.src).toMatch(/^https:\/\/cdn\.pendo\.io\/agent\/static\/.+\/pendo\.js$/);
    expect(fakeWindow.pendo).toBeDefined();
  });

  it('queues every method declared on the Pendo agent type', () => {
    const snippet = readNovusSnippet();
    const agentType = readPendoAgentType();

    ['initialize', 'identify', 'updateOptions', 'pageLoad', 'track', 'trackAgent', 'clearSession'].forEach((method) => {
      expect(snippet).toContain(`'${method}'`);
      expect(agentType).toMatch(new RegExp(`\\b${method}:`));
    });
  });

  it.each([
    ['localhost'],
    ['127.0.0.1'],
    ['preview-123.murphys-laws.pages.dev'],
    ['www.murphys-laws.com'],
    ['murphys-laws.com.evil.example'],
  ])('does not inject the loader or stub window.pendo on %s', (hostname) => {
    const { insertBefore, scriptElement, fakeWindow } = runSnippetOnHost(hostname);

    expect(insertBefore).not.toHaveBeenCalled();
    expect(scriptElement.src).toBeUndefined();
    expect(fakeWindow.pendo).toBeUndefined();
  });
});
