import { fileURLToPath } from 'node:url';

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
type SleepFn = (delayMs: number) => Promise<void>;
type LogFn = (message: string) => void;

interface WaitForHealthyEndpointOptions {
  name: string;
  url: string;
  attempts: number;
  delayMs: number;
  timeoutMs?: number;
  fetchFn?: FetchFn;
  sleep?: SleepFn;
  log?: LogFn;
}

const sleep: SleepFn = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs));

export async function waitForHealthyEndpoint({
  name,
  url,
  attempts,
  delayMs,
  timeoutMs = 5000,
  fetchFn = fetch,
  sleep: sleepFn = sleep,
  log = console.log,
}: WaitForHealthyEndpointOptions): Promise<void> {
  let lastFailure = 'No response received.';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(url, { signal: controller.signal });
      const body = await response.text();

      if (response.ok) {
        log(`${name} is healthy on attempt ${attempt}.`);
        return;
      }

      lastFailure = `HTTP ${response.status}: ${body || '(empty response body)'}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < attempts) {
      log(`${name} attempt ${attempt} failed: ${lastFailure}. Retrying in ${delayMs}ms.`);
      await sleepFn(delayMs);
    }
  }

  throw new Error(`${name} did not become healthy after ${attempts} attempt${attempts === 1 ? '' : 's'}. Last response: ${lastFailure}`);
}

async function main(): Promise<void> {
  const [name, url] = process.argv.slice(2);

  if (!name || !url) {
    throw new Error('Usage: wait-for-health-check.ts <name> <url>');
  }

  await waitForHealthyEndpoint({
    name,
    url,
    attempts: 12,
    delayMs: 5000,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
