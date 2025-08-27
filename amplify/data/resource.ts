import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a
  .schema({
    Trip: a
      .model({
        id: a.id(),
        name: a.string().required(),
        // Membership (Cognito sub IDs). We call this "owners" to pair with ownersDefinedIn.
        owners: a.string().array().required(), // ["sub1","sub2",...]
        admins: a.string().array(),
        coverPhoto: a.string(),
        createdBy: a.string().required(),
        // Add relationships
        lists: a.hasMany('List', 'tripId'),
        invites: a.hasMany('TripInvite', 'tripId'),
      })
      .authorization((allow) => [allow.ownersDefinedIn("owners")]),

    List: a
      .model({
        id: a.id(),
        tripId: a.id().required(),
        name: a.string().required(),
        createdBy: a.string().required(),
        owners: a.string().array(),
        // Add relationships
        trip: a.belongsTo('Trip', 'tripId'),
        items: a.hasMany('ListItem', 'listId'),
      })
      .authorization((allow) => [
        allow.ownersDefinedIn("owners"),
      ]),

    ListItem: a
      .model({
        id: a.id(),
        listId: a.id().required(),
        // Basic item info
        title: a.string().required(),
        note: a.string(),
        voteCount: a.integer().default(0),
        likedBy: a.string().array(),
        createdBy: a.string().required(), // Fixed field name
        owners: a.string().array(),
        // Google Places data
        placeId: a.string(), // Made optional since not all items need to be places
        placeName: a.string(),
        placeAddress: a.string(),
        placeTypes: a.string().array(),
        placeRating: a.float(),
        placePhotoReference: a.string(),
        // Add relationships
        list: a.belongsTo('List', 'listId'),
        comments: a.hasMany('Comment', 'itemId'),
      })
      .authorization((allow) => [
        allow.ownersDefinedIn("owners"),
      ]),

    Comment: a
      .model({
        id: a.id(),
        itemId: a.id().required(),
        body: a.string().required(),
        authorId: a.string().required(),
        createdAt: a.datetime().required(),
        owners: a.string().array(),
        // Add relationship
        item: a.belongsTo('ListItem', 'itemId'),
      })
      .authorization((allow) => [
        allow.ownersDefinedIn("owners"),
        allow.ownerDefinedIn("authorId"),
      ]),

    // Simplified shareable invitation links - no Lambda needed!
    TripInvite: a
      .model({
        id: a.id(), // This becomes the shareable invite code
        tripId: a.id().required(),
        createdBy: a.string().required(),
        expiresAt: a.datetime().required(),
        maxUses: a.integer().default(1), // Default to single use
        usedCount: a.integer().default(0),
        usedBy: a.string().array(), // Track who used the invite (Cognito sub IDs)
        isActive: a.boolean().default(true),
        // Add relationship
        trip: a.belongsTo('Trip', 'tripId'),
      })
      .authorization((allow) => [
        // Anyone authenticated can read invites (needed for joining)
        allow.authenticated().to(['read']),
        // Only the creator can manage their invites
        allow.ownerDefinedIn("createdBy").to(['create', 'update', 'delete']),
      ]),
  });

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema });
