import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

// Types ---------------------------------------------------------------------

interface AppSyncEvent {
  info?: {
    fieldName?: string;
    parentTypeName?: string;
  };
  arguments?: Record<string, any>;
  identity?: {
    sub?: string;
    username?: string;
    claims?: Record<string, any>;
  };
  source?: Record<string, any>;
  detailType?: string;
  sourceArn?: string;
  [key: string]: any;
}

interface Trip {
  id: string;
  name: string;
  owners: string[];
  admins?: string[];
  coverPhoto?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface List {
  id: string;
  tripId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ListItem {
  id: string;
  listId: string;
  title: string;
  note?: string | null;
  voteCount: number;
  likedBy?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  placeId?: string | null;
  placeName?: string | null;
  placeAddress?: string | null;
  placeTypes?: string[];
  placeRating?: number | null;
  placePhotoReference?: string | null;
  placePhotoUrl?: string | null;
}

interface TripInvite {
  id: string;
  tripId: string;
  createdBy: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  usedBy?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InviteInfo {
  invite?: TripInvite | null;
  trip?: Trip | null;
  status: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'CONSUMED' | 'INVALID';
}

// Initialisation ------------------------------------------------------------

const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'ap-southeast-2';
const TRIPS_TABLE = process.env.TRIPS_TABLE_NAME ?? '';
const LISTS_TABLE = process.env.LISTS_TABLE_NAME ?? '';
const LIST_ITEMS_TABLE = process.env.LIST_ITEMS_TABLE_NAME ?? '';
const COMMENTS_TABLE = process.env.COMMENTS_TABLE_NAME ?? '';
const TRIP_INVITES_TABLE = process.env.TRIP_INVITES_TABLE_NAME ?? '';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME ?? '';
const STAGE_NAME = process.env.STAGE_NAME ?? 'dev';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const eventBridge = new EventBridgeClient({ region: REGION });

// Utility helpers -----------------------------------------------------------

function requireTableEnv(variable: string, value: string) {
  if (!value) {
    throw new Error(`Missing environment variable: ${variable}`);
  }
}

[ ['TRIPS_TABLE_NAME', TRIPS_TABLE], ['LISTS_TABLE_NAME', LISTS_TABLE], ['LIST_ITEMS_TABLE_NAME', LIST_ITEMS_TABLE], ['TRIP_INVITES_TABLE_NAME', TRIP_INVITES_TABLE] ].forEach(([name, value]) => requireTableEnv(name, value as string));

function nowIso(): string {
  return new Date().toISOString();
}

function requireAuth(event: AppSyncEvent): string {
  const sub = event.identity?.sub ?? event.identity?.username;
  if (!sub) {
    throw new Error('Not authorised');
  }
  return sub;
}

async function emitEvent(detailType: string, detail: Record<string, any>) {
  if (!EVENT_BUS_NAME) return;
  try {
    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: EVENT_BUS_NAME,
            Source: 'hakuba.appsync',
            DetailType: detailType,
            Detail: JSON.stringify({ ...detail, stage: STAGE_NAME }),
          },
        ],
      })
    );
  } catch (error) {
    console.warn('Failed to emit event', detailType, error);
  }
}

async function fetchTrip(id: string): Promise<Trip | null> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TRIPS_TABLE, Key: { id } })
  );
  return (result.Item as Trip | undefined) ?? null;
}

async function ensureTripAccess(tripId: string, userId: string): Promise<Trip> {
  const trip = await fetchTrip(tripId);
  if (!trip) {
    throw new Error('Trip not found');
  }
  if (!trip.owners?.includes(userId)) {
    throw new Error('Not authorised to access this trip');
  }
  return trip;
}

async function fetchList(id: string): Promise<List | null> {
  const result = await dynamo.send(
    new GetCommand({ TableName: LISTS_TABLE, Key: { id } })
  );
  return (result.Item as List | undefined) ?? null;
}

async function fetchListItem(id: string): Promise<ListItem | null> {
  const result = await dynamo.send(
    new GetCommand({ TableName: LIST_ITEMS_TABLE, Key: { id } })
  );
  return (result.Item as ListItem | undefined) ?? null;
}

function mapTrip(item: Trip): Trip {
  return {
    ...item,
    admins: item.admins ?? [],
    owners: item.owners ?? [],
  };
}

function mapList(item: List): List {
  return { ...item };
}

function mapListItem(item: ListItem): ListItem {
  return {
    ...item,
    likedBy: item.likedBy ?? [],
    note: item.note ?? null,
    placeId: item.placeId ?? null,
    placeName: item.placeName ?? null,
    placeAddress: item.placeAddress ?? null,
    placeTypes: item.placeTypes ?? [],
    placeRating: item.placeRating ?? null,
    placePhotoReference: item.placePhotoReference ?? null,
    placePhotoUrl: item.placePhotoUrl ?? null,
  };
}

function mapInvite(item: TripInvite): TripInvite {
  return {
    ...item,
    usedBy: item.usedBy ?? [],
  };
}

function computeInviteStatus(invite: TripInvite): InviteInfo['status'] {
  const now = nowIso();
  if (!invite) return 'INVALID';
  if (!invite.isActive) return 'INACTIVE';
  if (invite.usedCount >= invite.maxUses) return 'CONSUMED';
  if (invite.expiresAt <= now) return 'EXPIRED';
  return 'ACTIVE';
}

// Query handlers ------------------------------------------------------------

async function handleGetTrip(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { id } = event.arguments ?? {};
  if (!id) throw new Error('Trip id is required');

  const trip = await fetchTrip(id);
  if (!trip) return null;
  if (!trip.owners?.includes(userId)) {
    throw new Error('Not authorised to view this trip');
  }
  return mapTrip(trip);
}

function parseNextToken(nextToken?: string | null) {
  if (!nextToken) return undefined;
  try {
    return JSON.parse(nextToken);
  } catch {
    return undefined;
  }
}

async function handleListTripsByUser(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { userId: targetUserId, limit = 200, nextToken } = event.arguments ?? {};
  if (!targetUserId) throw new Error('userId is required');
  if (targetUserId !== userId) {
    throw new Error('Not authorised to list trips for other users');
  }

  const response = await dynamo.send(
    new ScanCommand({
      TableName: TRIPS_TABLE,
      FilterExpression: 'contains(#owners, :owner)',
      ExpressionAttributeNames: { '#owners': 'owners' },
      ExpressionAttributeValues: { ':owner': userId },
      Limit: Math.min(limit, 200),
      ExclusiveStartKey: parseNextToken(nextToken),
    })
  );

  const items = (response.Items ?? []).map((item) => mapTrip(item as Trip));
  return { items, nextToken: response.LastEvaluatedKey ? JSON.stringify(response.LastEvaluatedKey) : null };
}

async function handleListListsByTrip(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { tripId, limit = 100, nextToken } = event.arguments ?? {};
  if (!tripId) throw new Error('tripId is required');
  await ensureTripAccess(tripId, userId);

  const response = await dynamo.send(
    new QueryCommand({
      TableName: LISTS_TABLE,
      IndexName: 'tripId-createdAt',
      KeyConditionExpression: 'tripId = :tripId',
      ExpressionAttributeValues: { ':tripId': tripId },
      ScanIndexForward: true,
      Limit: Math.min(limit, 200),
      ExclusiveStartKey: parseNextToken(nextToken),
    })
  );
  const items = (response.Items ?? []).map((item) => mapList(item as List));
  return { items, nextToken: response.LastEvaluatedKey ? JSON.stringify(response.LastEvaluatedKey) : null };
}

async function handleListItemsByList(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { tripId, listId, limit = 200, nextToken } = event.arguments ?? {};
  if (!tripId || !listId) throw new Error('tripId and listId are required');
  await ensureTripAccess(tripId, userId);

  const response = await dynamo.send(
    new QueryCommand({
      TableName: LIST_ITEMS_TABLE,
      IndexName: 'listId-createdAt',
      KeyConditionExpression: 'listId = :listId',
      ExpressionAttributeValues: { ':listId': listId },
      ScanIndexForward: true,
      Limit: Math.min(limit, 200),
      ExclusiveStartKey: parseNextToken(nextToken),
    })
  );
  const items = (response.Items ?? []).map((item) => mapListItem(item as ListItem));
  return { items, nextToken: response.LastEvaluatedKey ? JSON.stringify(response.LastEvaluatedKey) : null };
}

async function handleListCommentsByItem(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { itemId, limit = 200, nextToken } = event.arguments ?? {};
  if (!itemId) throw new Error('itemId is required');

  const item = await fetchListItem(itemId);
  if (!item) throw new Error('Item not found');
  const list = await fetchList(item.listId);
  if (!list) throw new Error('List not found');
  await ensureTripAccess(list.tripId, userId);

  if (!COMMENTS_TABLE) {
    return { items: [], nextToken: null };
  }

  const response = await dynamo.send(
    new QueryCommand({
      TableName: COMMENTS_TABLE,
      IndexName: 'itemId-createdAt',
      KeyConditionExpression: 'itemId = :itemId',
      ExpressionAttributeValues: { ':itemId': itemId },
      ScanIndexForward: true,
      Limit: Math.min(limit, 200),
      ExclusiveStartKey: parseNextToken(nextToken),
    })
  );

  const items = (response.Items ?? []).map((comment) => comment);
  return { items, nextToken: response.LastEvaluatedKey ? JSON.stringify(response.LastEvaluatedKey) : null };
}

async function handleGetTripInviteInfo(event: AppSyncEvent): Promise<InviteInfo> {
  const userId = requireAuth(event);
  const { inviteId } = event.arguments ?? {};
  if (!inviteId) throw new Error('inviteId is required');

  const inviteResult = await dynamo.send(
    new GetCommand({ TableName: TRIP_INVITES_TABLE, Key: { id: inviteId } })
  );
  const invite = (inviteResult.Item as TripInvite | undefined) ?? null;

  if (!invite) {
    return { invite: null, trip: null, status: 'INVALID' };
  }

  const trip = await fetchTrip(invite.tripId);
  if (!trip) {
    return { invite: mapInvite(invite), trip: null, status: 'INVALID' };
  }

  if (!trip.owners?.includes(userId)) {
    // We still return invite info but ensure status communicates restriction
    return {
      invite: mapInvite(invite),
      trip: mapTrip(trip),
      status: computeInviteStatus(invite),
    };
  }

  return {
    invite: mapInvite(invite),
    trip: mapTrip(trip),
    status: computeInviteStatus(invite),
  };
}

// Mutation handlers ---------------------------------------------------------

async function handleCreateTrip(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { input } = event.arguments ?? {};
  if (!input?.name) throw new Error('Trip name is required');

  const now = nowIso();
  const tripId = randomUUID();
  const trip: Trip = {
    id: tripId,
    name: input.name,
    owners: [userId],
    admins: [userId],
    coverPhoto: input.coverPhoto ?? null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await dynamo.send(
    new PutCommand({
      TableName: TRIPS_TABLE,
      Item: trip,
      ConditionExpression: 'attribute_not_exists(id)',
    })
  );

  // Always create a default list so the trip has a landing place
  const defaultList: List = {
    id: randomUUID(),
    tripId,
    name: 'General',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  await dynamo.send(
    new PutCommand({
      TableName: LISTS_TABLE,
      Item: defaultList,
      ConditionExpression: 'attribute_not_exists(id)',
    })
  );

  await emitEvent('TripCreated', { tripId, userId });
  return mapTrip(trip);
}

async function handleUpdateTrip(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { input } = event.arguments ?? {};
  if (!input?.id) throw new Error('Trip id is required');
  const trip = await ensureTripAccess(input.id, userId);

  const now = nowIso();
  const updateValues: Record<string, any> = {
    ':now': now,
  };
  const updateFragments: string[] = ['updatedAt = :now'];

  if (input.name != null) {
    updateFragments.push('#name = :name');
    updateValues[':name'] = input.name;
  }
  if (input.coverPhoto !== undefined) {
    updateFragments.push('coverPhoto = :coverPhoto');
    updateValues[':coverPhoto'] = input.coverPhoto ?? null;
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: TRIPS_TABLE,
      Key: { id: input.id },
      UpdateExpression: 'SET ' + updateFragments.join(', '),
      ConditionExpression: 'attribute_exists(id)',
      ExpressionAttributeValues: updateValues,
      ExpressionAttributeNames: input.name != null ? { '#name': 'name' } : undefined,
    })
  );

  const updatedTrip = await fetchTrip(input.id);
  await emitEvent('TripUpdated', { tripId: input.id, userId });
  return mapTrip((updatedTrip ?? trip) as Trip);
}

async function handleDeleteTrip(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { id } = event.arguments ?? {};
  if (!id) throw new Error('Trip id is required');
  await ensureTripAccess(id, userId);
  const trip = await fetchTrip(id);

  await dynamo.send(new DeleteCommand({ TableName: TRIPS_TABLE, Key: { id } }));

  // Cascade delete lists
  const lists = await dynamo.send(
    new QueryCommand({
      TableName: LISTS_TABLE,
      IndexName: 'tripId-createdAt',
      KeyConditionExpression: 'tripId = :tripId',
      ExpressionAttributeValues: { ':tripId': id },
    })
  );
  const listIds = (lists.Items ?? []).map((item) => (item as List).id);
  for (const listId of listIds) {
    await dynamo.send(new DeleteCommand({ TableName: LISTS_TABLE, Key: { id: listId } }));

    // Delete list items for each list
    const items = await dynamo.send(
      new QueryCommand({
        TableName: LIST_ITEMS_TABLE,
        IndexName: 'listId-createdAt',
        KeyConditionExpression: 'listId = :listId',
        ExpressionAttributeValues: { ':listId': listId },
      })
    );
    for (const item of items.Items ?? []) {
      await dynamo.send(
        new DeleteCommand({
          TableName: LIST_ITEMS_TABLE,
          Key: { id: (item as ListItem).id },
        })
      );
    }
  }

  // Delete invites belonging to the trip
  const invites = await dynamo.send(
    new ScanCommand({
      TableName: TRIP_INVITES_TABLE,
      FilterExpression: 'tripId = :tripId',
      ExpressionAttributeValues: { ':tripId': id },
    })
  );
  for (const invite of invites.Items ?? []) {
    await dynamo.send(
      new DeleteCommand({
        TableName: TRIP_INVITES_TABLE,
        Key: { id: (invite as TripInvite).id },
      })
    );
  }

  await emitEvent('TripDeleted', { tripId: id, userId });
  return mapTrip(
    trip ?? {
      id,
      name: '',
      owners: [userId],
      createdBy: userId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
  );
}

async function handleCreateList(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { input } = event.arguments ?? {};
  if (!input?.tripId || !input?.name) throw new Error('tripId and name are required');
  await ensureTripAccess(input.tripId, userId);

  const now = nowIso();
  const list: List = {
    id: randomUUID(),
    tripId: input.tripId,
    name: input.name,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await dynamo.send(
    new PutCommand({
      TableName: LISTS_TABLE,
      Item: list,
      ConditionExpression: 'attribute_not_exists(id)',
    })
  );

  await emitEvent('ListCreated', { tripId: input.tripId, listId: list.id, userId });
  return mapList(list);
}

async function handleCreateListItem(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { input } = event.arguments ?? {};
  if (!input?.listId || !input?.title) throw new Error('listId and title are required');

  const list = await fetchList(input.listId);
  if (!list) throw new Error('List not found');
  await ensureTripAccess(list.tripId, userId);

  const now = nowIso();
  const item: ListItem = {
    id: randomUUID(),
    listId: input.listId,
    title: input.title,
    note: input.note ?? null,
    voteCount: 0,
    likedBy: [],
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    placeId: input.placeId ?? null,
    placeName: input.placeName ?? null,
    placeAddress: input.placeAddress ?? null,
    placeTypes: input.placeTypes ?? [],
    placeRating: input.placeRating ?? null,
    placePhotoReference: input.placePhotoReference ?? null,
    placePhotoUrl: input.placePhotoUrl ?? null,
  };

  await dynamo.send(
    new PutCommand({
      TableName: LIST_ITEMS_TABLE,
      Item: item,
      ConditionExpression: 'attribute_not_exists(id)',
    })
  );

  await emitEvent('ListItemCreated', { listId: input.listId, itemId: item.id, userId });
  return mapListItem(item);
}

async function handleToggleListItemVote(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { itemId, like } = event.arguments ?? {};
  if (!itemId || typeof like !== 'boolean') throw new Error('itemId and like flag are required');

  const item = await fetchListItem(itemId);
  if (!item) throw new Error('Item not found');

  const list = await fetchList(item.listId);
  if (!list) throw new Error('List not found');
  await ensureTripAccess(list.tripId, userId);

  const likedBy = new Set(item.likedBy ?? []);
  if (like) {
    likedBy.add(userId);
  } else {
    likedBy.delete(userId);
  }
  const updatedItem = {
    ...item,
    likedBy: Array.from(likedBy),
    voteCount: likedBy.size,
    updatedAt: nowIso(),
  };

  await dynamo.send(
    new UpdateCommand({
      TableName: LIST_ITEMS_TABLE,
      Key: { id: itemId },
      UpdateExpression: 'SET likedBy = :likedBy, voteCount = :voteCount, updatedAt = :now',
      ExpressionAttributeValues: {
        ':likedBy': updatedItem.likedBy,
        ':voteCount': updatedItem.voteCount,
        ':now': updatedItem.updatedAt,
      },
    })
  );

  await emitEvent('ListItemUpdated', { listId: item.listId, itemId, userId, voteCount: updatedItem.voteCount });
  return mapListItem(updatedItem);
}

async function handleCreateTripInvite(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { input } = event.arguments ?? {};
  if (!input?.tripId) throw new Error('tripId is required');

  const trip = await ensureTripAccess(input.tripId, userId);

  const now = nowIso();
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const invite: TripInvite = {
    id: randomUUID(),
    tripId: input.tripId,
    createdBy: userId,
    expiresAt,
    maxUses: input.maxUses ?? 1,
    usedCount: 0,
    usedBy: [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await dynamo.send(
    new PutCommand({
      TableName: TRIP_INVITES_TABLE,
      Item: invite,
      ConditionExpression: 'attribute_not_exists(id)',
    })
  );

  await emitEvent('TripInviteCreated', { tripId: trip.id, inviteId: invite.id, userId });
  return mapInvite(invite);
}

async function handleJoinTripInvite(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { input } = event.arguments ?? {};
  if (!input?.inviteId) throw new Error('inviteId is required');

  const inviteResult = await dynamo.send(
    new GetCommand({ TableName: TRIP_INVITES_TABLE, Key: { id: input.inviteId } })
  );
  const invite = (inviteResult.Item as TripInvite | undefined) ?? null;
  if (!invite) throw new Error('Invitation not found');

  if (!invite.isActive) throw new Error('Invitation is inactive');
  if (invite.expiresAt <= nowIso()) throw new Error('Invitation has expired');
  if (invite.usedCount >= invite.maxUses) throw new Error('Invitation has been fully used');

  const trip = await fetchTrip(invite.tripId);
  if (!trip) throw new Error('Trip not found');

  if (trip.owners?.includes(userId)) {
    return mapTrip(trip);
  }

  const updatedOwners = Array.from(new Set([...(trip.owners ?? []), userId]));
  const now = nowIso();

  await dynamo.send(
    new UpdateCommand({
      TableName: TRIPS_TABLE,
      Key: { id: trip.id },
      UpdateExpression: 'SET owners = :owners, updatedAt = :now',
      ExpressionAttributeValues: {
        ':owners': updatedOwners,
        ':now': now,
      },
    })
  );

  const updatedUsedBy = Array.from(new Set([...(invite.usedBy ?? []), userId]));
  await dynamo.send(
    new UpdateCommand({
      TableName: TRIP_INVITES_TABLE,
      Key: { id: invite.id },
      UpdateExpression: 'SET usedBy = :usedBy, usedCount = :usedCount, updatedAt = :now',
      ConditionExpression: 'usedCount < maxUses AND isActive = :true',
      ExpressionAttributeValues: {
        ':usedBy': updatedUsedBy,
        ':usedCount': updatedUsedBy.length,
        ':now': now,
        ':true': true,
      },
    })
  );

  await emitEvent('TripInviteConsumed', { tripId: trip.id, inviteId: invite.id, userId });
  return mapTrip({ ...trip, owners: updatedOwners, updatedAt: now });
}

async function handlePurgeExpiredInvites(event: AppSyncEvent) {
  const userId = requireAuth(event);
  const { tripId } = event.arguments ?? {};
  if (!tripId) throw new Error('tripId is required');
  await ensureTripAccess(tripId, userId);

  const now = nowIso();
  const response = await dynamo.send(
    new ScanCommand({
      TableName: TRIP_INVITES_TABLE,
      FilterExpression: 'tripId = :tripId AND expiresAt <= :now AND isActive = :true',
      ExpressionAttributeValues: {
        ':tripId': tripId,
        ':now': now,
        ':true': true,
      },
    })
  );

  let counter = 0;
  for (const item of response.Items ?? []) {
    const invite = item as TripInvite;
    await dynamo.send(
      new UpdateCommand({
        TableName: TRIP_INVITES_TABLE,
        Key: { id: invite.id },
        UpdateExpression: 'SET isActive = :false, updatedAt = :now',
        ExpressionAttributeValues: {
          ':false': false,
          ':now': now,
        },
      })
    );
    counter += 1;
  }

  if (counter > 0) {
    await emitEvent('TripInvitesPurged', { tripId, count: counter });
  }
  return counter;
}

// Subscription resolvers ----------------------------------------------------

async function handleSubscription(event: AppSyncEvent) {
  // Subscriptions rely on direct AppSync mapping templates; return source if present.
  return event.source ?? null;
}

// Main handler --------------------------------------------------------------

export const handler = async (event: AppSyncEvent): Promise<any> => {
  if (event.info?.fieldName) {
    const field = event.info.fieldName;
    switch (field) {
      case '_health':
        return `ok:${nowIso()}`;
      case 'getTrip':
        return handleGetTrip(event);
      case 'listTripsByUser':
        return handleListTripsByUser(event);
      case 'listListsByTrip':
        return handleListListsByTrip(event);
      case 'listItemsByList':
        return handleListItemsByList(event);
      case 'listCommentsByItem':
        return handleListCommentsByItem(event);
      case 'getTripInviteInfo':
        return handleGetTripInviteInfo(event);
      case 'createTrip':
        return handleCreateTrip(event);
      case 'updateTrip':
        return handleUpdateTrip(event);
      case 'deleteTrip':
        return handleDeleteTrip(event);
      case 'createList':
        return handleCreateList(event);
      case 'createListItem':
        return handleCreateListItem(event);
      case 'toggleListItemVote':
        return handleToggleListItemVote(event);
      case 'createTripInvite':
        return handleCreateTripInvite(event);
      case 'joinTripInvite':
        return handleJoinTripInvite(event);
      case 'purgeExpiredInvites':
        return handlePurgeExpiredInvites(event);
      case 'onTripUpdated':
      case 'onListItemsChanged':
      case 'onInviteStatusChanged':
        return handleSubscription(event);
      default:
        throw new Error(`Resolver for field "${field}" is not implemented yet.`);
    }
  }

  if (event.detailType || event.source) {
    // EventBridge invocation
    console.log('EventBridge invocation received:', JSON.stringify(event, null, 2));
    return { status: 'event-received' };
  }

  console.warn('Unknown invocation shape, returning noop response');
  return null;
};
