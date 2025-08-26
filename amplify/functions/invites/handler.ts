import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

// <-- Replace with the name used in invites/resource.ts -->
import { env } from "$amplify/env/invites-fn";

import { randomUUID } from "crypto";
import type { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

type JwtCtx = {
  jwt?: { claims?: Record<string, any> };
  iam?: { cognitoIdentity?: { identityId?: string } };
};

function ok(body: any = {}) {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
    },
    body: JSON.stringify(body),
  };
}
function bad(status = 400, message = "Bad Request") {
  return { statusCode: status, body: JSON.stringify({ error: message }) };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const body = event.body ? JSON.parse(event.body) : {};
  const authz = (event.requestContext as any).authorizer as JwtCtx | undefined;
  const sub = authz?.jwt?.claims?.sub ?? authz?.iam?.cognitoIdentity?.identityId;

  if (!sub) return bad(401, "Unauthenticated");

  // POST /invites/mint { tripId, hours? }
  if (method === "POST" && path.endsWith("/invites/mint")) {
    const { tripId, hours } = body as { tripId: string; hours?: number };
    if (!tripId) return bad(422, "tripId required");

    const trip = await client.models.Trip.get({ id: tripId });
    if (!trip.data) return bad(404, "Trip not found");
    // Only members/admins mint invites
    if (!trip.data.owners?.includes(sub)) return bad(403, "Not a member");

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * (hours ?? 72)).toISOString();

    await client.models.Invite.create({
      id: token,
      tripId,
      createdBy: sub,
      expiresAt,
      maxUses: 1,
      usedCount: 0,
    });

    return ok({ token, expiresAt });
  }

  // POST /invites/redeem { token }
  if (method === "POST" && path.endsWith("/invites/redeem")) {
    const { token } = body as { token: string };
    if (!token) return bad(422, "token required");

    const invite = await client.models.Invite.get({ id: token });
    if (!invite.data) return bad(404, "Invite not found");

    const inv = invite.data;
    if (new Date(inv.expiresAt).getTime() < Date.now()) return bad(410, "Invite expired");
    if ((inv.maxUses ?? null) !== null && (inv.usedCount ?? 0) >= (inv.maxUses ?? 0)) return bad(409, "Invite already used");

    const trip = await client.models.Trip.get({ id: inv.tripId });
    if (!trip.data) return bad(404, "Trip not found");

    const owners = Array.from(new Set([...(trip.data.owners ?? []), sub]));

    // Add user to trip membership
    await client.models.Trip.update({ id: trip.data.id, owners });

    // Mark invite as used (single-use)
    await client.models.Invite.update({
      id: inv.id,
      usedCount: (inv.usedCount ?? 0) + 1,
      usedBy: Array.from(new Set([...(inv.usedBy ?? []), sub])),
    });

    return ok({ joinedTripId: trip.data.id });
  }

  return bad(404, "Route not found");
};