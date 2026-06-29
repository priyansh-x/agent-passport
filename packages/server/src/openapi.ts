export function getOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Agent Passport Authority API',
      version: '0.1.0',
      description: 'REST API for issuing, validating, and managing AI agent passports.',
      license: { name: 'MIT' },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          responses: { '200': { description: 'Server is healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } } },
        },
      },
      '/v1/passports': {
        get: {
          summary: 'List all passports',
          responses: { '200': { description: 'List of passports' } },
        },
        post: {
          summary: 'Issue a new passport',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/IssueRequest' } } } },
          responses: { '201': { description: 'Passport issued' } },
        },
      },
      '/v1/passports/{id}': {
        get: {
          summary: 'Get passport by ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Passport details' }, '404': { description: 'Not found' } },
        },
      },
      '/v1/passports/{id}/authorize': {
        post: {
          summary: 'Authorize an action against a passport',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { action: { type: 'string' }, spendAmount: { type: 'number' } }, required: ['action'] } } } },
          responses: { '200': { description: 'Authorization result' } },
        },
      },
      '/v1/passports/{id}/delegate': {
        post: {
          summary: 'Delegate a passport to a sub-agent',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DelegateRequest' } } } },
          responses: { '201': { description: 'Delegated passport' }, '400': { description: 'Delegation denied' } },
        },
      },
      '/v1/passports/{id}/revoke': {
        post: {
          summary: 'Revoke a passport (cascades to children)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'List of revoked passport IDs' } },
        },
      },
      '/v1/passports/{id}/verify': {
        post: {
          summary: 'Verify passport validity',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Verification result' } },
        },
      },
      '/v1/passports/{id}/introspect': {
        post: {
          summary: 'Token introspection (RFC 7662-style)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Full token introspection' } },
        },
      },
      '/v1/passports/{id}/audit': {
        get: {
          summary: 'Get audit log for a passport',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Audit entries' } },
        },
      },
      '/v1/passports/{id}/tree': {
        get: {
          summary: 'Get delegation tree',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Delegation tree' }, '404': { description: 'Not found' } },
        },
      },
      '/v1/passports/{id}/validate': {
        get: {
          summary: 'Validate passport with detailed errors and warnings',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Validation result' } },
        },
      },
      '/v1/passports/{id}/token': {
        get: {
          summary: 'Export passport as compact token string',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Compact token' } },
        },
      },
      '/v1/stats': {
        get: {
          summary: 'Get aggregate statistics',
          responses: { '200': { description: 'Server statistics' } },
        },
      },
      '/v1/audit': {
        get: {
          summary: 'Get recent audit log entries',
          parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } }],
          responses: { '200': { description: 'Recent audit entries' } },
        },
      },
      '/v1/webhooks': {
        get: {
          summary: 'List webhook subscriptions',
          responses: { '200': { description: 'Webhook list' } },
        },
        post: {
          summary: 'Subscribe to webhook events',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' }, events: { type: 'array', items: { type: 'string' } }, secret: { type: 'string' } }, required: ['url', 'events'] } } } },
          responses: { '201': { description: 'Webhook created' } },
        },
      },
      '/v1/webhooks/{id}': {
        delete: {
          summary: 'Unsubscribe a webhook',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Webhook removed' }, '404': { description: 'Not found' } },
        },
      },
    },
    components: {
      schemas: {
        IssueRequest: {
          type: 'object',
          properties: {
            principal: { type: 'string', example: 'user:alice@company.com' },
            agent: { type: 'string', example: 'agent:booking-bot' },
            permissions: { type: 'array', items: { type: 'string' }, example: ['calendar:read', 'email:send'] },
            limits: { type: 'object', properties: { maxSpend: { type: 'number' }, currency: { type: 'string' } } },
            expiresIn: { type: 'number', description: 'Milliseconds until expiration' },
          },
          required: ['principal', 'agent', 'permissions'],
        },
        DelegateRequest: {
          type: 'object',
          properties: {
            agent: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } },
            limits: { type: 'object', properties: { maxSpend: { type: 'number' }, currency: { type: 'string' } } },
            expiresIn: { type: 'number' },
          },
          required: ['agent', 'permissions'],
        },
      },
    },
  };
}
