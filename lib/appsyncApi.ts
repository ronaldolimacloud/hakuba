import { executeGraphQL } from './graphqlClient';
import { AuthTokens } from '../providers/AuthProvider';
import { Comment, InviteInfo, List, ListItem, Trip, TripInvite } from './appsyncTypes';

export async function listTripsByUser(
  userId: string,
  tokens: AuthTokens | null
): Promise<Trip[]> {
  const result = await executeGraphQL<{ listTripsByUser?: { items: Trip[] } }>(
    {
      query: `
        query ListTripsByUser($userId: ID!, $limit: Int) {
          listTripsByUser(userId: $userId, limit: $limit) {
            items {
              id
              name
              owners
              admins
              coverPhoto
              createdBy
              createdAt
              updatedAt
            }
          }
        }
      `,
      variables: { userId, limit: 200 },
    },
    tokens
  );

  return result.data?.listTripsByUser?.items ?? [];
}

export async function createTrip(
  input: { name: string; coverPhoto?: string | null },
  tokens: AuthTokens | null
): Promise<Trip> {
  const result = await executeGraphQL<{ createTrip: Trip }>(
    {
      query: `
        mutation CreateTrip($input: CreateTripInput!) {
          createTrip(input: $input) {
            id
            name
            owners
            admins
            coverPhoto
            createdBy
            createdAt
            updatedAt
          }
        }
      `,
      variables: { input },
    },
    tokens
  );
  if (!result.data?.createTrip) {
    throw new Error('createTrip did not return a trip');
  }
  return result.data.createTrip;
}

export async function getTrip(id: string, tokens: AuthTokens | null): Promise<Trip | null> {
  const result = await executeGraphQL<{ getTrip?: Trip }>(
    {
      query: `
        query GetTrip($id: ID!) {
          getTrip(id: $id) {
            id
            name
            owners
            admins
            coverPhoto
            createdBy
            createdAt
            updatedAt
          }
        }
      `,
      variables: { id },
    },
    tokens
  );
  return result.data?.getTrip ?? null;
}

export async function deleteTrip(
  id: string,
  tokens: AuthTokens | null
): Promise<Trip> {
  const result = await executeGraphQL<{ deleteTrip: Trip }>(
    {
      query: `
        mutation DeleteTrip($id: ID!) {
          deleteTrip(id: $id) {
            id
            name
            owners
            createdBy
            createdAt
            updatedAt
          }
        }
      `,
      variables: { id },
    },
    tokens
  );

  if (!result.data?.deleteTrip) {
    throw new Error('deleteTrip did not return a trip');
  }
  return result.data.deleteTrip;
}

export async function listListsByTrip(
  tripId: string,
  tokens: AuthTokens | null
): Promise<List[]> {
  const result = await executeGraphQL<{ listListsByTrip?: { items: List[] } }>(
    {
      query: `
        query ListsByTrip($tripId: ID!, $limit: Int) {
          listListsByTrip(tripId: $tripId, limit: $limit) {
            items {
              id
              tripId
              name
              createdBy
              createdAt
              updatedAt
            }
          }
        }
      `,
      variables: { tripId, limit: 100 },
    },
    tokens
  );
  return result.data?.listListsByTrip?.items ?? [];
}

export async function createList(
  input: { tripId: string; name: string },
  tokens: AuthTokens | null
): Promise<List> {
  const result = await executeGraphQL<{ createList: List }>(
    {
      query: `
        mutation CreateList($input: CreateListInput!) {
          createList(input: $input) {
            id
            tripId
            name
            createdBy
            createdAt
            updatedAt
          }
        }
      `,
      variables: { input },
    },
    tokens
  );

  if (!result.data?.createList) {
    throw new Error('createList did not return a list');
  }
  return result.data.createList;
}

export async function listItemsByList(
  tripId: string,
  listId: string,
  tokens: AuthTokens | null
): Promise<ListItem[]> {
  const result = await executeGraphQL<{ listItemsByList?: { items: ListItem[] } }>(
    {
      query: `
        query ListItemsByList($tripId: ID!, $listId: ID!, $limit: Int) {
          listItemsByList(tripId: $tripId, listId: $listId, limit: $limit) {
            items {
              id
              listId
              title
              note
              voteCount
              likedBy
              createdBy
              createdAt
              updatedAt
              placeId
              placeName
              placeAddress
              placeTypes
              placeRating
              placePhotoReference
              placePhotoUrl
            }
          }
        }
      `,
      variables: { tripId, listId, limit: 200 },
    },
    tokens
  );
  return result.data?.listItemsByList?.items ?? [];
}

export async function createListItem(
  input: Omit<ListItem, 'id' | 'createdAt' | 'updatedAt' | 'voteCount'> & {
    voteCount?: number;
  },
  tokens: AuthTokens | null
): Promise<ListItem> {
  const result = await executeGraphQL<{ createListItem: ListItem }>(
    {
      query: `
        mutation CreateListItem($input: CreateListItemInput!) {
          createListItem(input: $input) {
            id
            listId
            title
            note
            voteCount
            likedBy
            createdBy
            createdAt
            updatedAt
            placeId
            placeName
            placeAddress
            placeTypes
            placeRating
            placePhotoReference
            placePhotoUrl
          }
        }
      `,
      variables: { input },
    },
    tokens
  );
  if (!result.data?.createListItem) {
    throw new Error('createListItem did not return an item');
  }
  return result.data.createListItem;
}

export async function toggleListItemVote(
  itemId: string,
  like: boolean,
  tokens: AuthTokens | null
): Promise<ListItem> {
  const result = await executeGraphQL<{ toggleListItemVote: ListItem }>(
    {
      query: `
        mutation ToggleListItemVote($itemId: ID!, $like: Boolean!) {
          toggleListItemVote(itemId: $itemId, like: $like) {
            id
            listId
            title
            note
            voteCount
            likedBy
            createdBy
            createdAt
            updatedAt
            placeId
            placeName
            placeAddress
            placeTypes
            placeRating
            placePhotoReference
            placePhotoUrl
          }
        }
      `,
      variables: { itemId, like },
    },
    tokens
  );
  if (!result.data?.toggleListItemVote) {
    throw new Error('toggleListItemVote did not return an item');
  }
  return result.data.toggleListItemVote;
}

export async function createTripInvite(
  input: { tripId: string; maxUses?: number | null; expiresAt?: string | null },
  tokens: AuthTokens | null
): Promise<TripInvite> {
  const result = await executeGraphQL<{ createTripInvite: TripInvite }>(
    {
      query: `
        mutation CreateTripInvite($input: CreateTripInviteInput!) {
          createTripInvite(input: $input) {
            id
            tripId
            createdBy
            expiresAt
            maxUses
            usedCount
            usedBy
            isActive
            createdAt
            updatedAt
          }
        }
      `,
      variables: { input },
    },
    tokens
  );
  if (!result.data?.createTripInvite) {
    throw new Error('createTripInvite did not return an invite');
  }
  return result.data.createTripInvite;
}

export async function joinTripInvite(
  input: { inviteId: string },
  tokens: AuthTokens | null
): Promise<Trip> {
  const result = await executeGraphQL<{ joinTripInvite: Trip }>(
    {
      query: `
        mutation JoinTripInvite($input: JoinTripInviteInput!) {
          joinTripInvite(input: $input) {
            id
            name
            owners
            admins
            createdBy
            createdAt
            updatedAt
          }
        }
      `,
      variables: { input },
    },
    tokens
  );
  if (!result.data?.joinTripInvite) {
    throw new Error('joinTripInvite did not return a trip');
  }
  return result.data.joinTripInvite;
}

export async function getTripInviteInfo(
  inviteId: string,
  tokens: AuthTokens | null
): Promise<InviteInfo> {
  const result = await executeGraphQL<{ getTripInviteInfo?: InviteInfo }>(
    {
      query: `
        query GetTripInviteInfo($inviteId: ID!) {
          getTripInviteInfo(inviteId: $inviteId) {
            status
            invite {
              id
              tripId
              createdBy
              expiresAt
              maxUses
              usedCount
              usedBy
              isActive
              createdAt
              updatedAt
            }
            trip {
              id
              name
              owners
              admins
              createdBy
              createdAt
              updatedAt
            }
          }
        }
      `,
      variables: { inviteId },
    },
    tokens
  );
  if (!result.data?.getTripInviteInfo) {
    throw new Error('Invite not found');
  }
  return result.data.getTripInviteInfo;
}

export async function listCommentsByItem(
  itemId: string,
  tokens: AuthTokens | null
): Promise<Comment[]> {
  const result = await executeGraphQL<{ listCommentsByItem?: { items: Comment[] } }>(
    {
      query: `
        query ListComments($itemId: ID!, $limit: Int) {
          listCommentsByItem(itemId: $itemId, limit: $limit) {
            items {
              id
              itemId
              body
              authorId
              createdAt
            }
          }
        }
      `,
      variables: { itemId, limit: 200 },
    },
    tokens
  );
  return result.data?.listCommentsByItem?.items ?? [];
}
