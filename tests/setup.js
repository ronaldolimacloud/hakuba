/**
 * Test setup for AppSync resolver unit tests
 * This file provides utilities for testing AppSync resolvers
 */

// Mock the AppSync utils module
export const mockUtil = {
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
      if (Array.isArray(value)) return { L: value.map(v => mockUtil.dynamodb.toDynamoDB(v)) };
      if (value === null || value === undefined) return { NULL: true };
      return { S: String(value) };
    }),
  },
};

// Mock context factory
export const createMockContext = (overrides = {}) => ({
  args: {},
  identity: {
    sub: 'test-user-id',
  },
  result: null,
  error: null,
  stash: {},
  ...overrides,
});

// Mock DynamoDB responses
export const createMockDynamoDBItem = (item) => {
  const dynamoItem = {};
  for (const [key, value] of Object.entries(item)) {
    dynamoItem[key] = mockUtil.dynamodb.toDynamoDB(value);
  }
  return dynamoItem;
};

// Test data factories
export const createTestInvite = (overrides = {}) => ({
  id: 'test-invite-123',
  tripId: 'test-trip-456',
  createdBy: 'test-user-id',
  expiresAt: '2024-12-31T23:59:59.000Z',
  maxUses: 5,
  usedCount: 0,
  usedBy: [],
  isActive: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

export const createTestTrip = (overrides = {}) => ({
  id: 'test-trip-456',
  name: 'Test Trip',
  owners: ['test-user-id'],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});