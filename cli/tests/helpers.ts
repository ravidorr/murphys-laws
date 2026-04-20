import type { MurphysLawsClient, SubmitLawResult } from 'murphys-laws-sdk';

export interface TestStream {
  write(s: string): boolean;
  output: string;
}

export function createStream(): TestStream {
  const stream: TestStream = {
    output: '',
    write(s: string): boolean {
      stream.output += s;
      return true;
    },
  };
  return stream;
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

export interface StubClientCalls {
  baseUrl: string | undefined;
  userAgent: string | undefined;
}

export function createStubClient(
  behavior: StubClientBehavior,
  opts: { baseUrl?: string; userAgent?: string } = {},
): MurphysLawsClient {
  return {
    baseUrl: opts.baseUrl ?? 'https://api.test',
    userAgent: opts.userAgent ?? 'test-agent',
    async get() {
      throw new Error('get not stubbed');
    },
    async post() {
      throw new Error('post not stubbed');
    },
    searchLaws: behavior.searchLaws ?? (() => {
      throw new Error('searchLaws not stubbed');
    }),
    getRandomLaw: behavior.getRandomLaw ?? (() => {
      throw new Error('getRandomLaw not stubbed');
    }),
    getLawOfTheDay: behavior.getLawOfTheDay ?? (() => {
      throw new Error('getLawOfTheDay not stubbed');
    }),
    getLaw: behavior.getLaw ?? (() => {
      throw new Error('getLaw not stubbed');
    }),
    listCategories: behavior.listCategories ?? (() => {
      throw new Error('listCategories not stubbed');
    }),
    getLawsByCategory: behavior.getLawsByCategory ?? (() => {
      throw new Error('getLawsByCategory not stubbed');
    }),
    submitLaw: behavior.submitLaw ?? (() => {
      throw new Error('submitLaw not stubbed');
    }),
  } as unknown as MurphysLawsClient;
}
