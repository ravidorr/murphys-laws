/**
 * Backwards-compatible shim kept for one minor release.
 * Prefer importing `MurphysLawsClient` directly from `murphys-laws-sdk` in new code.
 * This shim adapts the SDK client to the legacy `ApiClient` shape used by the
 * existing MCP tools.
 */
import { MurphysLawsClient, ApiError as SdkApiError } from 'murphys-laws-sdk';

export const ApiError = SdkApiError;
export type ApiError = InstanceType<typeof SdkApiError>;

export class ApiClient {
  private readonly client: MurphysLawsClient;

  constructor(baseUrl: string) {
    this.client = new MurphysLawsClient({
      baseUrl,
      userAgent: 'murphys-laws-mcp',
    });
  }

  get<T>(path: string): Promise<T> {
    return this.client.get<T>(path);
  }

  post<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
    return this.client.post<T>(path, body);
  }
}
