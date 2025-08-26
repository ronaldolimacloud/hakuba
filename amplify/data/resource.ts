import { a, defineData, type ClientSchema } from "@aws-amplify/backend";
import { simpleInvitesFn } from "../functions/simple-invites/resource";

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
        // Add relationships
        trip: a.belongsTo('Trip', 'tripId'),
        items: a.hasMany('ListItem', 'listId'),
      })
      .authorization((allow) => [
        // Only allow trip owners to manage lists (checked via Lambda)
        allow.authenticated(),
      ]),

    ListItem: a
      .model({
        id: a.id(),
        listId: a.id().required(),
        placeId: a.string().required(),
        title: a.string(),
        note: a.string(),
        voteCount: a.integer().default(0),
        likedBy: a.string().array(),
        addedBy: a.string().required(),
        // Add relationships
        list: a.belongsTo('List', 'listId'),
        comments: a.hasMany('Comment', 'itemId'),
      })
      .authorization((allow) => [
        // Only allow trip owners to manage list items (checked via Lambda)
        allow.authenticated(),
      ]),

    Comment: a
      .model({
        id: a.id(),
        itemId: a.id().required(),
        body: a.string().required(),
        authorId: a.string().required(),
        createdAt: a.datetime().required(),
        // Add relationship
        item: a.belongsTo('ListItem', 'itemId'),
      })
      .authorization((allow) => [
        // Only allow trip owners to manage comments (checked via Lambda)
        allow.authenticated(),
      ]),

    // Shareable invitation links (like TriCount)
    TripInvite: a
      .model({
        id: a.id(), // This becomes the shareable invite code
        tripId: a.id().required(),
        createdBy: a.string().required(),
        expiresAt: a.datetime().required(),
        maxUses: a.integer(), // Optional: limit how many people can use it
        usedCount: a.integer().default(0),
        usedBy: a.string().array(), // Track who used the invite (Cognito sub IDs)
        isActive: a.boolean().default(true),
        // Add relationship
        trip: a.belongsTo('Trip', 'tripId'),
      })
      .authorization((allow) => [
        // Only authenticated users can create/use invitations
        allow.authenticated(),
      ]),
  })
  // Grant the simpleInvitesFn server-side access to read/mutate Data
  .authorization((allow) => [allow.resource(simpleInvitesFn)]);

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema });
