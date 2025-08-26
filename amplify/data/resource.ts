import { a, defineData, type ClientSchema } from "@aws-amplify/backend";
import { invitesFn } from "../functions/invites/resource";

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
      })
      .authorization((allow) => [allow.ownersDefinedIn("owners")]),

    List: a
      .model({
        id: a.id(),
        tripId: a.id().required(),
        name: a.string().required(),
        owners: a.string().array().required(), // copy of Trip.owners at create time
        createdBy: a.string().required(),
      })
      .authorization((allow) => [allow.ownersDefinedIn("owners")]),

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
        owners: a.string().array().required(), // copy of parent list owners
      })
      .authorization((allow) => [allow.ownersDefinedIn("owners")]),

    Comment: a
      .model({
        id: a.id(),
        itemId: a.id().required(),
        body: a.string().required(),
        authorId: a.string().required(),
        createdAt: a.datetime().required(),
        owners: a.string().array().required(),
      })
      .authorization((allow) => [allow.ownersDefinedIn("owners")]),

    Invite: a
      .model({
        id: a.id(), // token
        tripId: a.id().required(),
        createdBy: a.string().required(),
        expiresAt: a.datetime().required(),
        maxUses: a.integer().default(1),
        usedCount: a.integer().default(0),
        usedBy: a.string().array(),
        owners: a.string().array(),
      })
      // Do not expose generally; only owners (defaults empty) can access
      .authorization((allow) => [allow.ownersDefinedIn("owners")]),
  })
  // Grant the invitesFn server-side access to read/mutate Data
  .authorization((allow) => [allow.resource(invitesFn).to(["query", "mutate"])]); // schema-level rule

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema });
