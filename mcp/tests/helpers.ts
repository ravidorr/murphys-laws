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
}

function unstubbed(method: string): never {
  throw new Error(`${method} not stubbed`);
}

export function createStubClient(behavior: StubClientBehavior): MurphysLawsClient {
  return {
    baseUrl: 'https://api.test',
    userAgent: 'test-agent',
    get: () => unstubbed('get'),
    post: () => unstubbed('post'),
    searchLaws: behavior.searchLaws ?? (() => unstubbed('searchLaws')),
    getRandomLaw: behavior.getRandomLaw ?? (() => unstubbed('getRandomLaw')),
    getLawOfTheDay: behavior.getLawOfTheDay ?? (() => unstubbed('getLawOfTheDay')),
    getLaw: behavior.getLaw ?? (() => unstubbed('getLaw')),
    listCategories: behavior.listCategories ?? (() => unstubbed('listCategories')),
    getLawsByCategory: behavior.getLawsByCategory ?? (() => unstubbed('getLawsByCategory')),
    submitLaw: behavior.submitLaw ?? (() => unstubbed('submitLaw')),
  } as unknown as MurphysLawsClient;
}
