import { describe, expect, it } from 'vitest';
import { OPENAPI_SPEC } from '../src/openapi.ts';

type OpenApiSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, unknown>;
  $ref?: string;
};

type OpenApiResponse = {
  description: string;
  content?: Record<string, { schema: OpenApiSchema }>;
};

type OpenApiOperation = {
  operationId: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema: OpenApiSchema;
  }>;
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: OpenApiSchema }>;
  };
  responses: Record<string, OpenApiResponse>;
};

const openApiPaths = OPENAPI_SPEC.paths as unknown as Record<string, {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  delete?: OpenApiOperation;
}>;

function getJsonSchema(response: OpenApiResponse): OpenApiSchema {
  return response.content?.['application/json'].schema ?? {};
}

describe('OpenAPI contract', () => {
  it('covers every public API operation registered by the server', () => {
    const publicOperations = {
      '/api/health': ['get'],
      '/api/v1/openapi.json': ['get'],
      '/api/v1/laws': ['get', 'post'],
      '/api/v1/laws/suggestions': ['get'],
      '/api/v1/laws/duplicates': ['get'],
      '/api/v1/laws/random': ['get'],
      '/api/v1/laws/{id}': ['get'],
      '/api/v1/laws/{id}/related': ['get'],
      '/api/v1/law-of-day': ['get'],
      '/api/v1/laws/{id}/vote': ['post', 'delete'],
      '/api/v1/categories': ['get'],
      '/api/v1/categories/{slug}/related': ['get'],
      '/api/v1/categories/{id}': ['get'],
      '/api/v1/attributions': ['get'],
      '/api/v1/submitters': ['get'],
      '/api/v1/feed.rss': ['get'],
      '/api/v1/feed.atom': ['get'],
      '/api/v1/og/law/{id}.png': ['get'],
    } as const;

    for (const [path, methods] of Object.entries(publicOperations)) {
      const documentedPath = openApiPaths[path];

      expect(documentedPath).toBeDefined();
      for (const method of methods) {
        expect(documentedPath?.[method]).toBeDefined();
      }
    }
  });

  it('documents law submissions with the implemented rate limit and response', () => {
    const operation = openApiPaths['/api/v1/laws']?.post;

    expect(operation).toMatchObject({
      operationId: 'submitLaw',
      'x-ratelimit-limit': 3,
      'x-ratelimit-window': '1m',
    });
    expect(operation?.requestBody?.required).toBe(true);
    expect(operation?.requestBody?.content['application/json'].schema).toMatchObject({
      type: 'object',
      required: ['text'],
      properties: expect.objectContaining({
        text: { type: 'string', minLength: 10, maxLength: 1000 },
        title: { type: 'string' },
        author: { type: 'string' },
        email: { type: 'string', format: 'email' },
        category_id: { type: 'integer' },
      }),
    });
    expect(operation?.requestBody?.content['application/json'].schema.properties).not.toHaveProperty('anonymous');
    expect(getJsonSchema(operation!.responses['201'])).toMatchObject({
      type: 'object',
      required: ['id', 'title', 'text', 'status', 'message'],
      properties: expect.objectContaining({
        id: { type: 'integer' },
        title: { type: 'string', nullable: true },
        text: { type: 'string' },
        status: { type: 'string', enum: ['in_review'] },
        message: { type: 'string' },
      }),
    });
    expect(getJsonSchema(operation!.responses['400'])).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    });
    expect(getJsonSchema(operation!.responses['429'])).toEqual({
      $ref: '#/components/schemas/RateLimitErrorResponse',
    });
  });

  it('documents vote creation and removal with their public response shapes', () => {
    const votePath = openApiPaths['/api/v1/laws/{id}/vote'];
    const post = votePath?.post;
    const remove = votePath?.delete;

    expect(post).toMatchObject({
      operationId: 'voteOnLaw',
      parameters: [{
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer' },
      }],
    });
    expect(post?.requestBody?.content['application/json'].schema).toEqual({
      type: 'object',
      required: ['vote_type'],
      properties: {
        vote_type: { type: 'string', enum: ['up', 'down'] },
      },
    });
    expect(getJsonSchema(post!.responses['200'])).toEqual({
      $ref: '#/components/schemas/VoteCastResponse',
    });
    expect(getJsonSchema(post!.responses['400'])).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    });
    expect(getJsonSchema(post!.responses['404'])).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    });
    expect(getJsonSchema(post!.responses['429'])).toEqual({
      $ref: '#/components/schemas/RateLimitErrorResponse',
    });

    expect(remove).toMatchObject({
      operationId: 'removeVote',
      parameters: [{
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer' },
      }],
    });
    expect(getJsonSchema(remove!.responses['200'])).toEqual({
      $ref: '#/components/schemas/VoteResponse',
    });
    expect(getJsonSchema(remove!.responses['404'])).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    });
    expect(getJsonSchema(remove!.responses['429'])).toEqual({
      $ref: '#/components/schemas/RateLimitErrorResponse',
    });
  });

  it('documents the generated specification, submitter search, and Open Graph image endpoints', () => {
    const openApi = openApiPaths['/api/v1/openapi.json']?.get;
    const submitters = openApiPaths['/api/v1/submitters']?.get;
    const ogImage = openApiPaths['/api/v1/og/law/{id}.png']?.get;

    expect(openApi).toMatchObject({
      operationId: 'getOpenApiSpec',
    });
    expect(getJsonSchema(openApi!.responses['200'])).toMatchObject({
      type: 'object',
    });

    expect(submitters).toMatchObject({
      operationId: 'searchSubmitters',
      parameters: [
        {
          name: 'q',
          in: 'query',
          schema: { type: 'string' },
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      ],
    });
    expect(getJsonSchema(submitters!.responses['200'])).toEqual({
      $ref: '#/components/schemas/SubmitterList',
    });

    expect(ogImage).toMatchObject({
      operationId: 'getLawOpenGraphImage',
      parameters: [{
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer' },
      }],
    });
    expect(ogImage!.responses['200'].content?.['image/png'].schema).toEqual({
      type: 'string',
      format: 'binary',
    });
    for (const status of ['400', '404', '500']) {
      expect(getJsonSchema(ogImage!.responses[status])).toEqual({
        $ref: '#/components/schemas/ErrorResponse',
      });
    }
  });

  it('documents the health check response returned by the server', () => {
    const health = openApiPaths['/api/health']?.get;

    expect(getJsonSchema(health!.responses['200'])).toMatchObject({
      type: 'object',
      required: ['ok', 'dbQueryTime'],
      properties: {
        ok: { type: 'boolean', enum: [true] },
        dbQueryTime: { type: 'number' },
      },
    });
    expect(getJsonSchema(health!.responses['503'])).toMatchObject({
      type: 'object',
      required: ['ok', 'error', 'dbError'],
      properties: {
        ok: { type: 'boolean', enum: [false] },
        error: { type: 'string' },
        dbError: { type: 'string' },
      },
    });
  });
});
