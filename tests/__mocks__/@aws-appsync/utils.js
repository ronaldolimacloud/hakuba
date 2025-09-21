/**
 * Mock implementation of @aws-appsync/utils for testing
 */

export const util = {
  autoId: jest.fn(() => 'test-id-123'),
  error: jest.fn((message, type) => {
    throw new Error(`${type}: ${message}`);
  }),
  time: {
    nowISO8601: jest.fn(() => '2024-01-01T00:00:00.000Z'),
  },
  dynamodb: {
    toDynamoDB: jest.fn((value) => {
      if (typeof value === 'string') return { S: value };
      if (typeof value === 'number') return { N: value.toString() };
      if (typeof value === 'boolean') return { BOOL: value };
      if (Array.isArray(value)) return { L: value.map(v => util.dynamodb.toDynamoDB(v)) };
      if (value === null || value === undefined) return { NULL: true };
      return { S: String(value) };
    }),
  },
};