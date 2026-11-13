// WebMCP (Web Model Context Protocol): lets a browser agent call named tools that the page registers, instead of
// scraping the DOM. Chrome ships it behind an origin trial, so every call here is a no-op where
// `document.modelContext` is missing. https://developer.chrome.com/docs/ai/webmcp

/** What a tool's `execute` may return: structured JSON the agent can read. */
export type WebMcpResult = Record<string, unknown>;

export interface WebMcpTool {
  /** 1-128 characters: ASCII letters, digits, `_`, `-` and `.`. Unique on the page. */
  name: string;
  title: string;
  /** What the tool does and which side effects it has; agents use it to pick a tool and ask for consent. */
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>) => WebMcpResult | Promise<WebMcpResult>;
}

interface ModelContextLike {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => unknown;
}

// One live registration per tool name. Registering a name again first drops the old one, so a view that
// re-renders never leaves a tool bound to markup that is no longer in the page (a duplicate name would
// otherwise be rejected with InvalidStateError and keep the stale tool).
const registrations = new Map<string, AbortController>();

function getModelContext(): ModelContextLike | null {
  const modelContext = (document as Document & { modelContext?: ModelContextLike }).modelContext;
  return modelContext && typeof modelContext.registerTool === 'function' ? modelContext : null;
}

/**
 * Registers a tool for the current page and returns the function that removes it again. Call the returned
 * function when the view that owns the tool goes away.
 */
export function registerWebMcpTool(tool: WebMcpTool): () => void {
  const modelContext = getModelContext();
  if (!modelContext) return () => {};

  registrations.get(tool.name)?.abort();
  const controller = new AbortController();
  registrations.set(tool.name, controller);

  const unregister = () => {
    controller.abort();
    if (registrations.get(tool.name) === controller) registrations.delete(tool.name);
  };

  // The trial API may return a promise that rejects (policy, origin isolation, duplicate name) or throw
  // synchronously. The tool is an extra on top of the form, which keeps working either way.
  const reportFailure = (error: unknown) => {
    unregister();
    console.warn(`WebMCP tool "${tool.name}" was not registered`, error);
  };
  try {
    Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(reportFailure);
  } catch (error) {
    reportFailure(error);
  }
  return unregister;
}
