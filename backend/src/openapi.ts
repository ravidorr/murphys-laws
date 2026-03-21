export const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: "Murphy's Law Archive API",
    description:
      "A public REST API for browsing 1500+ Murphy's Laws, corollaries, and variations organized into thematic categories. No authentication required for read operations.",
    version: '1.0.0',
    contact: {
      url: 'https://murphys-laws.com/contact',
    },
    license: {
      name: 'CC0 1.0',
      url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    },
    'x-llms-txt': 'https://murphys-laws.com/llms.txt',
  },
  servers: [
    {
      url: 'https://murphys-laws.com',
      description: 'Production',
    },
  ],
  paths: {
    '/api/v1/laws': {
      post: {
        operationId: 'submitLaw',
        summary: 'Submit a new law',
        description: 'Submit a new law for community review. Rate limited to 5 submissions per hour per IP.',
        'x-ratelimit-limit': 5,
        'x-ratelimit-window': '1h',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', minLength: 10, maxLength: 1000 },
                  title: { type: 'string' },
                  author: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  category_id: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Law submitted successfully and pending review',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    title: { type: 'string', nullable: true },
                    text: { type: 'string' },
                    status: { type: 'string', enum: ['in_review'] },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '429': { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
      get: {
        operationId: 'listLaws',
        summary: 'List laws',
        description: 'Returns a paginated, filterable, sortable list of published laws.',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Number of results per page (1–25)',
            schema: { type: 'integer', minimum: 1, maximum: 25, default: 25 },
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Zero-based offset for pagination',
            schema: { type: 'integer', minimum: 0, default: 0 },
          },
          {
            name: 'q',
            in: 'query',
            description: 'Full-text search query',
            schema: { type: 'string' },
          },
          {
            name: 'category_slug',
            in: 'query',
            description: 'Filter by category slug (e.g. "murphys-technology-laws")',
            schema: { type: 'string' },
          },
          {
            name: 'category_id',
            in: 'query',
            description: 'Filter by numeric category ID',
            schema: { type: 'integer' },
          },
          {
            name: 'attribution',
            in: 'query',
            description: 'Partial match on attribution name',
            schema: { type: 'string' },
          },
          {
            name: 'sort',
            in: 'query',
            description: 'Sort field',
            schema: {
              type: 'string',
              enum: ['score', 'upvotes', 'created_at', 'last_voted_at'],
              default: 'score',
            },
          },
          {
            name: 'order',
            in: 'query',
            description: 'Sort direction',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
          {
            name: 'exclude_corollaries',
            in: 'query',
            description: 'Exclude corollary laws (1 or true)',
            schema: { type: 'string', enum: ['1', 'true'] },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated list of laws',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LawList' },
              },
            },
          },
        },
      },
    },
    '/api/v1/laws/random': {
      get: {
        operationId: 'getRandomLaw',
        summary: 'Get a random law',
        description: 'Returns a single randomly selected published law. Each call returns a fresh result.',
        responses: {
          '200': {
            description: 'A randomly selected law',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Law' },
              },
            },
          },
          '404': {
            description: 'No published laws available',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/laws/suggestions': {
      get: {
        operationId: 'getLawSuggestions',
        summary: 'Autocomplete suggestions',
        description: 'Returns up to 20 matching law snippets for autocomplete.',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: 'Search query (minimum 2 characters)',
            schema: { type: 'string', minLength: 2 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of suggestions (1–20)',
            schema: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
          },
        ],
        responses: {
          '200': {
            description: 'Autocomplete suggestions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          text: { type: 'string' },
                          title: { type: 'string', nullable: true },
                          score: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/laws/{id}': {
      get: {
        operationId: 'getLaw',
        summary: 'Get a law by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'The requested law',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Law' },
              },
            },
          },
          '400': {
            description: 'Invalid law ID',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          '404': {
            description: 'Law not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/laws/{id}/related': {
      get: {
        operationId: 'getRelatedLaws',
        summary: 'Get related laws',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of related laws (1–10)',
            schema: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
          },
        ],
        responses: {
          '200': {
            description: 'Related laws',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Law' } },
                    law_id: { type: 'integer' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Law not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/law-of-day': {
      get: {
        operationId: 'getLawOfTheDay',
        summary: "Get today's featured law",
        responses: {
          '200': {
            description: "Today's law of the day",
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    law: { $ref: '#/components/schemas/Law' },
                    featured_date: { type: 'string', format: 'date' },
                  },
                },
              },
            },
          },
          '404': { description: 'No published laws available', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/v1/categories': {
      get: {
        operationId: 'listCategories',
        summary: 'List all categories',
        responses: {
          '200': {
            description: 'All categories with law counts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/categories/{id}': {
      get: {
        operationId: 'getCategory',
        summary: 'Get a category by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': {
            description: 'The requested category',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } },
          },
          '404': { description: 'Category not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/v1/attributions': {
      get: {
        operationId: 'listAttributions',
        summary: 'List unique attribution names',
        responses: {
          '200': {
            description: 'List of unique attribution names',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/feed.rss': {
      get: {
        operationId: 'getRssFeed',
        summary: 'RSS 2.0 feed',
        responses: {
          '200': {
            description: 'RSS feed of recent laws',
            content: { 'application/rss+xml': { schema: { type: 'string' } } },
          },
        },
      },
    },
    '/api/v1/feed.atom': {
      get: {
        operationId: 'getAtomFeed',
        summary: 'Atom 1.0 feed',
        responses: {
          '200': {
            description: 'Atom feed of recent laws',
            content: { 'application/atom+xml': { schema: { type: 'string' } } },
          },
        },
      },
    },
    '/api/health': {
      get: {
        operationId: 'healthCheck',
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok'] },
                    db_query_ms: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Attribution: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          note: { type: 'string', nullable: true },
        },
      },
      Law: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          title: { type: 'string', nullable: true },
          text: { type: 'string' },
          file_path: { type: 'string', nullable: true },
          line_number: { type: 'integer', nullable: true },
          attributions: {
            type: 'array',
            items: { $ref: '#/components/schemas/Attribution' },
          },
          upvotes: { type: 'integer' },
          downvotes: { type: 'integer' },
          score: { type: 'integer' },
          category_id: { type: 'integer', nullable: true },
          category_ids: { type: 'array', items: { type: 'integer' } },
          category_slug: { type: 'string', nullable: true },
          category_name: { type: 'string', nullable: true },
        },
      },
      LawList: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Law' } },
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          q: { type: 'string' },
          category_id: { type: 'integer', nullable: true },
          category_slug: { type: 'string', nullable: true },
          attribution: { type: 'string' },
          sort: { type: 'string' },
          order: { type: 'string' },
        },
      },
      Category: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          slug: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          law_count: { type: 'integer' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
    },
  },
} as const;
