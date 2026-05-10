import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError, errorHandler, notFoundHandler } from './error.js';

function mockRes() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: Record<string, unknown> };
}

const mockReq = {} as Request;
const mockNext: NextFunction = vi.fn();

describe('errorHandler', () => {
  it('handles AppError with status code and error code', () => {
    const res = mockRes();
    const err = new AppError(403, 'FORBIDDEN', 'Access denied');

    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Access denied', code: 'FORBIDDEN' });
  });

  it('handles ZodError with 400 and details array', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = schema.safeParse({ name: 123, age: 'old' });
    const zodError = result.error!;

    const res = mockRes();
    errorHandler(zodError, mockReq, res, mockNext);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
    });
    expect((res.body as { details: string[] }).details).toBeInstanceOf(Array);
    expect((res.body as { details: string[] }).details.length).toBeGreaterThan(0);
  });

  it('handles unknown Error with 500 and generic message', () => {
    const res = mockRes();
    errorHandler(new Error('something broke'), mockReq, res, mockNext);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  });
});

describe('notFoundHandler', () => {
  it('returns 404 with NOT_FOUND code', () => {
    const res = mockRes();
    notFoundHandler(mockReq, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: 'Not found', code: 'NOT_FOUND' });
  });
});
