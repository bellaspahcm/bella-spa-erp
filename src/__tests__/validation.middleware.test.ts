/**
 * Validation Middleware Tests
 * 
 * Tests for request validation with Zod schemas
 * Covers body/query/params validation, XSS prevention, SQL injection detection
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
  blockTenantInjection,
  detectSQLInjection,
  sanitizeObject,
  validate,
} from '@/lib/middleware/validation.middleware';
import { APIError } from '@/lib/errors/api-error';

describe('Validation Middleware', () => {
  describe('validateBody', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number().int().positive(),
      email: z.string().email(),
    });

    it('validates correct body', async () => {
      const req = new NextRequest('https://api.bella.vn/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 30, email: 'john@example.com' }),
      });

      const result = await validateBody(req, schema);
      
      expect(result).toEqual({
        name: 'John',
        age: 30,
        email: 'john@example.com',
      });
    });

    it('rejects invalid body (missing field)', async () => {
      const req = new NextRequest('https://api.bella.vn/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 30 }), // Missing email
      });

      await expect(validateBody(req, schema)).rejects.toThrow(APIError);
      await expect(validateBody(req, schema)).rejects.toThrow('INVALID_INPUT');
    });

    it('rejects invalid body (wrong type)', async () => {
      const req = new NextRequest('https://api.bella.vn/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', age: 'thirty', email: 'john@example.com' }),
      });

      await expect(validateBody(req, schema)).rejects.toThrow(APIError);
    });

    it('rejects malformed JSON', async () => {
      const req = new NextRequest('https://api.bella.vn/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
      });

      await expect(validateBody(req, schema)).rejects.toThrow(APIError);
      await expect(validateBody(req, schema)).rejects.toThrow('Invalid JSON');
    });

    it('rejects wrong Content-Type', async () => {
      const req = new NextRequest('https://api.bella.vn/test', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ name: 'John', age: 30, email: 'john@example.com' }),
      });

      await expect(validateBody(req, schema)).rejects.toThrow(APIError);
      await expect(validateBody(req, schema)).rejects.toThrow('Invalid Content-Type');
    });

    it('provides detailed error messages', async () => {
      const req = new NextRequest('https://api.bella.vn/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', age: -5, email: 'invalid' }),
      });

      try {
        await validateBody(req, schema);
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        const apiError = error as APIError;
        expect(apiError.details.errors).toBeDefined();
        expect(apiError.details.errors.length).toBeGreaterThan(0);
        expect(apiError.details.errors[0]).toHaveProperty('field');
        expect(apiError.details.errors[0]).toHaveProperty('message');
      }
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      page: z.coerce.number().int().positive().default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
    });

    it('validates correct query parameters', () => {
      const req = new NextRequest('https://api.bella.vn/test?page=2&per_page=50&search=test');

      const result = validateQuery(req, schema);
      
      expect(result).toEqual({
        page: 2,
        per_page: 50,
        search: 'test',
      });
    });

    it('applies defaults for missing parameters', () => {
      const req = new NextRequest('https://api.bella.vn/test');

      const result = validateQuery(req, schema);
      
      expect(result).toEqual({
        page: 1,
        per_page: 20,
      });
    });

    it('rejects invalid query parameters', () => {
      const req = new NextRequest('https://api.bella.vn/test?page=0&per_page=200');

      expect(() => validateQuery(req, schema)).toThrow(APIError);
    });

    it('coerces string to number', () => {
      const req = new NextRequest('https://api.bella.vn/test?page=5');

      const result = validateQuery(req, schema);
      
      expect(result.page).toBe(5);
      expect(typeof result.page).toBe('number');
    });
  });

  describe('validateParams', () => {
    const schema = z.object({
      id: z.string().uuid(),
      slug: z.string().min(1),
    });

    it('validates correct path parameters', () => {
      const params = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'test-order',
      };

      const result = validateParams(params, schema);
      
      expect(result).toEqual(params);
    });

    it('rejects invalid UUID', () => {
      const params = {
        id: 'not-a-uuid',
        slug: 'test-order',
      };

      expect(() => validateParams(params, schema)).toThrow(APIError);
      expect(() => validateParams(params, schema)).toThrow('Invalid UUID');
    });
  });

  describe('blockTenantInjection', () => {
    it('allows normal request body', () => {
      const body = {
        customer_id: '123',
        name: 'Test',
      };

      expect(() => blockTenantInjection(body)).not.toThrow();
    });

    it('blocks tenant_id in request body', () => {
      const body = {
        customer_id: '123',
        tenant_id: 'malicious-tenant',
      };

      expect(() => blockTenantInjection(body)).toThrow(APIError);
      expect(() => blockTenantInjection(body)).toThrow('TENANT_INJECTION_ATTEMPT');
    });

    it('blocks tenantId (camelCase) in request body', () => {
      const body = {
        customer_id: '123',
        tenantId: 'malicious-tenant',
      };

      expect(() => blockTenantInjection(body)).toThrow(APIError);
    });

    it('blocks tenant in request body', () => {
      const body = {
        customer_id: '123',
        tenant: 'malicious-tenant',
      };

      expect(() => blockTenantInjection(body)).toThrow(APIError);
    });
  });

  describe('detectSQLInjection', () => {
    it('allows normal strings', () => {
      expect(() => detectSQLInjection('John Doe')).not.toThrow();
      expect(() => detectSQLInjection('Order #12345')).not.toThrow();
    });

    it('detects SELECT statement', () => {
      expect(() => detectSQLInjection("'; SELECT * FROM users --")).toThrow(APIError);
    });

    it('detects UNION attack', () => {
      expect(() => detectSQLInjection('1 UNION SELECT password FROM users')).toThrow(APIError);
    });

    it('detects OR 1=1 attack', () => {
      expect(() => detectSQLInjection("admin' OR 1=1 --")).toThrow(APIError);
    });

    it('detects comment injection', () => {
      expect(() => detectSQLInjection('test -- comment')).toThrow(APIError);
      expect(() => detectSQLInjection('test /* comment */')).toThrow(APIError);
    });

    it('detects DROP statement', () => {
      expect(() => detectSQLInjection('test; DROP TABLE users;')).toThrow(APIError);
    });
  });

  describe('sanitizeObject', () => {
    it('sanitizes string values', () => {
      const obj = {
        name: '<script>alert("XSS")</script>',
        description: 'Test "quote" and \'single\' quote',
      };

      const result = sanitizeObject(obj) as typeof obj;
      
      expect(result.name).not.toContain('<script>');
      expect(result.name).toContain('&lt;script&gt;');
      expect(result.description).toContain('&quot;');
      expect(result.description).toContain('&#x27;');
    });

    it('sanitizes nested objects', () => {
      const obj = {
        user: {
          name: '<b>Bold</b>',
          profile: {
            bio: '<i>Italic</i>',
          },
        },
      };

      const result = sanitizeObject(obj) as typeof obj;
      
      expect(result.user.name).toContain('&lt;b&gt;');
      expect(result.user.profile.bio).toContain('&lt;i&gt;');
    });

    it('sanitizes arrays', () => {
      const obj = {
        tags: ['<script>', '<img src=x>'],
      };

      const result = sanitizeObject(obj) as typeof obj;
      
      expect(result.tags[0]).toContain('&lt;script&gt;');
      expect(result.tags[1]).toContain('&lt;img');
    });

    it('preserves non-string values', () => {
      const obj = {
        name: 'John',
        age: 30,
        active: true,
        metadata: null,
      };

      const result = sanitizeObject(obj) as typeof obj;
      
      expect(result.age).toBe(30);
      expect(result.active).toBe(true);
      expect(result.metadata).toBe(null);
    });
  });

  describe('validate (combined)', () => {
    const bodySchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    const querySchema = z.object({
      page: z.coerce.number().int().positive().default(1),
    });

    it('validates both body and query', async () => {
      const req = new NextRequest('https://api.bella.vn/test?page=2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
      });

      const result = await validate(req, {
        bodySchema,
        querySchema,
      });

      expect(result.body).toEqual({ name: 'John', email: 'john@example.com' });
      expect(result.query).toEqual({ page: 2 });
    });

    it('validates only body when query schema not provided', async () => {
      const req = new NextRequest('https://api.bella.vn/test?page=2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
      });

      const result = await validate(req, { bodySchema });

      expect(result.body).toEqual({ name: 'John', email: 'john@example.com' });
      expect(result.query).toBeUndefined();
    });

    it('checks tenant injection by default', async () => {
      const req = new NextRequest('https://api.bella.vn/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'John',
          email: 'john@example.com',
          tenant_id: 'malicious',
        }),
      });

      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        tenant_id: z.string().optional(), // Allow in schema but should be blocked
      });

      await expect(validate(req, { bodySchema: schema })).rejects.toThrow('TENANT_INJECTION_ATTEMPT');
    });

    it('skips tenant injection check when disabled', async () => {
      const req = new NextRequest('https://api.bella.vn/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'John',
          email: 'john@example.com',
          tenant_id: 'allowed',
        }),
      });

      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
        tenant_id: z.string(),
      });

      const result = await validate(req, {
        bodySchema: schema,
        checkTenantInjection: false,
      });

      expect(result.body).toHaveProperty('tenant_id', 'allowed');
    });
  });
});
