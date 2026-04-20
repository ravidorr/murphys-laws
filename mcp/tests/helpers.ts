import type { MurphysLawsClient, SubmitLawResult } from 'murphys-laws-sdk';

type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>;

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface CapturedTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: ToolHandler;
}

export interface CapturingServer {
  tools: Map<string, CapturedTool>;
  tool(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    handler: ToolHandler,
  ): void;
}

export function createCapturingServer(): CapturingServer {
  const tools = new Map<string, CapturedTool>();
  return {
    tools,
    tool(name, description, schema, handler) {
      tools.set(name, { name, description, schema, handler });
    },
  };
}

export interface StubClientBehavior {
  searchLaws?: (...args: Parameters<MurphysLawsClient['searchLaws']>) => Promise<unknown>;
  getRandomLaw?: () => Promise<unknown>;
  getLawOfTheDay?: () => Promise<unknown>;
  getLaw?: (id: number | string) => Promise<unknown>;
  listCategories?: () => Promise<unknown>;
  getLawsByCategory?: (
    ...args: Parameters<MurphysLawsClient['getLawsByCategory']>
  ) => Promise<unknown>;
  submitLaw?: (...args: Parameters<MurphysLawsClient['submitLaw']>) => Promise<SubmitLawResult>;
  get?: (path: string) => Promise<unknown>;
  post?: (path: string, body: unknown) => Promise<{ status: number; data: unknown }>;
}

export function createStubClient(behavior: StubClientBehavior): MurphysLawsClient {
  return {
    baseUrl: 'https://api.test',
    userAgent: 'test-agent',
    get: behavior.get ?? (() => Promise.reject(new Error('get not stubbed'))),
    post: behavior.post ?? (() => Promise.reject(new Error('post not stubbed'))),
    searchLaws: behavior.searchLaws ?? (() => Promise.reject(new Error('searchLaws not stubbed'))),
    getRandomLaw: behavior.getRandomLaw ?? (() => Promise.reject(new Error('getRandomLaw not stubbed'))),
    getLawOfTheDay: behavior.getLawOfTheDay ?? (() => Promise.reject(new Error('getLawOfTheDay not stubbed'))),
    getLaw: behavior.getLaw ?? (() => Promise.reject(new Error('getLaw not stubbed'))),
    listCategories: behavior.listCategories ?? (() => Promise.reject(new Error('listCategories not stubbed'))),
    getLawsByCategory: behavior.getLawsByCategory ?? (() => Promise.reject(new Error('getLawsByCategory not stubbed'))),
    submitLaw: behavior.submitLaw ?? (() => Promise.reject(new Error('submitLaw not stubbed'))),
  } as unknown as MurphysLawsClient;
}
