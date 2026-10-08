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
  post?: OpenApiOperation;
  delete?: OpenApiOperation;
}>;

function getJsonSchema(response: OpenApiResponse): OpenApiSchema {
  return response.content?.['application/json'].schema ?? {};
}

describe('OpenAPI write endpoint contract', () => {
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
});
