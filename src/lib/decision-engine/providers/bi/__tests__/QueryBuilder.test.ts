/**
 * QueryBuilder Tests
 * 
 * Tests for fluent query builder API.
 */

import {
  aggregation,
  sql,
  threshold,
  timeSeries,
  QueryBuilder,
} from '../QueryBuilder';

describe('QueryBuilder', () => {
  describe('SQL Query Builder', () => {
    it('should build basic SQL query', () => {
      const query = sql('SELECT * FROM users WHERE id = :id')
        .params({ id: 123 })
        .build();

      expect(query.type).toBe('sql');
      expect(query.query).toBe('SELECT * FROM users WHERE id = :id');
      expect(query.parameters).toEqual({ id: 123 });
    });

    it('should set result type', () => {
      const query = sql('SELECT COUNT(*) FROM users').single().build();
      expect(query.resultType).toBe('single');
    });

    it('should use static method', () => {
      const query = QueryBuilder.sql()
        .sql('SELECT 1')
        .build();

      expect(query.type).toBe('sql');
    });
  });

  describe('Aggregation Query Builder', () => {
    it('should build COUNT query', () => {
      const query = aggregation()
        .table('bookings')
        .count()
        .build();

      expect(query.type).toBe('aggregation');
      expect(query.table).toBe('bookings');
      expect(query.function).toBe('COUNT');
      expect(query.column).toBe('*');
    });

    it('should build SUM query', () => {
      const query = aggregation()
        .table('bookings')
        .sum('amount')
        .build();

      expect(query.function).toBe('SUM');
      expect(query.column).toBe('amount');
    });

    it('should build AVG query', () => {
      const query = aggregation()
        .table('bookings')
        .avg('rating')
        .build();

      expect(query.function).toBe('AVG');
      expect(query.column).toBe('rating');
    });

    it('should add filters', () => {
      const query = aggregation()
        .table('bookings')
        .count()
        .where('status', 'approved')
        .where('customer_id', 123)
        .build();

      expect(query.filters).toEqual({
        status: 'approved',
        customer_id: 123,
      });
    });

    it('should add GROUP BY', () => {
      const query = aggregation()
        .table('bookings')
        .count()
        .groupBy('status', 'type')
        .build();

      expect(query.groupBy).toEqual(['status', 'type']);
    });

    it('should add time range', () => {
      const query = aggregation()
        .table('bookings')
        .count()
        .timeRange({ start: '2024-01-01', end: '2024-12-31' })
        .build();

      expect(query.timeRange).toEqual({
        start: '2024-01-01',
        end: '2024-12-31',
      });
    });

    it('should throw error without table', () => {
      expect(() => {
        aggregation().count().build();
      }).toThrow('Table name is required');
    });
  });

  describe('Time-Series Query Builder', () => {
    it('should build time-series query', () => {
      const query = timeSeries()
        .table('sessions')
        .metric('revenue')
        .function('SUM')
        .timeRange({ start: '2024-01-01', end: '2024-12-31' })
        .build();

      expect(query.type).toBe('time-series');
      expect(query.table).toBe('sessions');
      expect(query.metric).toBe('revenue');
      expect(query.function).toBe('SUM');
    });

    it('should throw error without time range', () => {
      expect(() => {
        timeSeries()
          .table('sessions')
          .metric('revenue')
          .build();
      }).toThrow('Time range is required');
    });
  });

  describe('Threshold Builder', () => {
    it('should build > threshold', () => {
      const t = threshold().gt(100).build();
      expect(t.operator).toBe('>');
      expect(t.value).toBe(100);
    });

    it('should build >= threshold', () => {
      const t = threshold().gte(50).build();
      expect(t.operator).toBe('>=');
      expect(t.value).toBe(50);
    });

    it('should build < threshold', () => {
      const t = threshold().lt(10).build();
      expect(t.operator).toBe('<');
      expect(t.value).toBe(10);
    });

    it('should build <= threshold', () => {
      const t = threshold().lte(5).build();
      expect(t.operator).toBe('<=');
      expect(t.value).toBe(5);
    });

    it('should build = threshold', () => {
      const t = threshold().eq(42).build();
      expect(t.operator).toBe('=');
      expect(t.value).toBe(42);
    });

    it('should build between threshold', () => {
      const t = threshold().between(10, 20).build();
      expect(t.operator).toBe('between');
      expect(t.value).toEqual([10, 20]);
    });

    it('should build in threshold', () => {
      const t = threshold().in([1, 2, 3]).build();
      expect(t.operator).toBe('in');
      expect(t.value).toEqual([1, 2, 3]);
    });

    it('should set fallback', () => {
      const t = threshold().gte(100).fallback(true).build();
      expect(t.fallback).toBe(true);
    });
  });

  describe('Method Chaining', () => {
    it('should support fluent API', () => {
      const query = aggregation()
        .table('bookings')
        .count()
        .where('status', 'approved')
        .where('customer_id', 123)
        .groupBy('type')
        .timeRange({ start: '2024-01-01', end: '2024-12-31' })
        .timeColumn('created_at')
        .build();

      expect(query.type).toBe('aggregation');
      expect(query.table).toBe('bookings');
      expect(query.filters).toHaveProperty('status');
      expect(query.groupBy).toContain('type');
      expect(query.timeRange).toBeDefined();
    });
  });
});
