import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

import type { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig({
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
  AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN!,
  AWS_REGION: process.env.AWS_REGION!,
  AMPLIFY_DATA_DEFAULT_NAME: process.env.AMPLIFY_DATA_DEFAULT_NAME!
});
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
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
    },
    body: JSON.stringify(body),
  };
}

function bad(status = 400, message = "Bad Request") {
  return { 
    statusCode: status, 
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
    },
    body: JSON.stringify({ error: message }) 
  };
}

/**
 * Check if a user has access to a Trip through ownership
 */
async function checkTripAccess(tripId: string, userSub: string): Promise<boolean> {
  try {
    const trip = await client.models.Trip.get({ id: tripId });
    return trip.data?.owners?.includes(userSub) ?? false;
  } catch (error) {
    console.error("Error checking trip access:", error);
    return false;
  }
}

/**
 * Check if a user has access to a List through Trip ownership
 */
async function checkListAccess(listId: string, userSub: string): Promise<boolean> {
  try {
    const list = await client.models.List.get({ id: listId });
    if (!list.data?.tripId) return false;
    
    return await checkTripAccess(list.data.tripId, userSub);
  } catch (error) {
    console.error("Error checking list access:", error);
    return false;
  }
}

/**
 * Check if a user has access to a ListItem through List → Trip ownership
 */
async function checkListItemAccess(itemId: string, userSub: string): Promise<boolean> {
  try {
    const item = await client.models.ListItem.get({ id: itemId });
    if (!item.data?.listId) return false;
    
    return await checkListAccess(item.data.listId, userSub);
  } catch (error) {
    console.error("Error checking list item access:", error);
    return false;
  }
}

/**
 * Check if a user has access to a Comment through Item → List → Trip ownership
 */
async function checkCommentAccess(commentId: string, userSub: string): Promise<boolean> {
  try {
    const comment = await client.models.Comment.get({ id: commentId });
    if (!comment.data?.itemId) return false;
    
    return await checkListItemAccess(comment.data.itemId, userSub);
  } catch (error) {
    console.error("Error checking comment access:", error);
    return false;
  }
}

/**
 * Get Trip ID from various resource types
 */
async function getTripIdFromResource(resourceType: string, resourceId: string): Promise<string | null> {
  try {
    switch (resourceType) {
      case 'Trip':
        return resourceId;
        
      case 'List':
        const list = await client.models.List.get({ id: resourceId });
        return list.data?.tripId ?? null;
        
      case 'ListItem':
        const item = await client.models.ListItem.get({ id: resourceId });
        if (!item.data?.listId) return null;
        const parentList = await client.models.List.get({ id: item.data.listId });
        return parentList.data?.tripId ?? null;
        
      case 'Comment':
        const comment = await client.models.Comment.get({ id: resourceId });
        if (!comment.data?.itemId) return null;
        return await getTripIdFromResource('ListItem', comment.data.itemId);
        
      case 'TripInvite':
        const invite = await client.models.TripInvite.get({ id: resourceId });
        return invite.data?.tripId ?? null;
        
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error getting trip ID for ${resourceType}:${resourceId}:`, error);
    return null;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const body = event.body ? JSON.parse(event.body) : {};
  const authz = (event.requestContext as any).authorizer as JwtCtx | undefined;
  
  // Extract user identifier
  const sub = authz?.jwt?.claims?.sub ?? 
              authz?.jwt?.claims?.["cognito:username"] ?? 
              authz?.iam?.cognitoIdentity?.identityId;

  if (!sub) {
    console.log("Auth debug - no sub found:", JSON.stringify(authz, null, 2));
    return bad(401, "Unauthenticated");
  }

  // POST /auth/check-access { resourceType, resourceId }
  if (method === "POST" && path.endsWith("/auth/check-access")) {
    const { resourceType, resourceId } = body as { resourceType: string; resourceId: string };
    
    if (!resourceType || !resourceId) {
      return bad(422, "resourceType and resourceId required");
    }

    let hasAccess = false;
    
    try {
      switch (resourceType) {
        case 'Trip':
          hasAccess = await checkTripAccess(resourceId, sub);
          break;
        case 'List':
          hasAccess = await checkListAccess(resourceId, sub);
          break;
        case 'ListItem':
          hasAccess = await checkListItemAccess(resourceId, sub);
          break;
        case 'Comment':
          hasAccess = await checkCommentAccess(resourceId, sub);
          break;
        default:
          return bad(400, "Unsupported resource type");
      }
      
      return ok({ hasAccess, resourceType, resourceId, userSub: sub });
    } catch (error) {
      console.error("Access check failed:", error);
      return bad(500, "Access check failed");
    }
  }

  // POST /auth/get-trip-id { resourceType, resourceId }
  if (method === "POST" && path.endsWith("/auth/get-trip-id")) {
    const { resourceType, resourceId } = body as { resourceType: string; resourceId: string };
    
    if (!resourceType || !resourceId) {
      return bad(422, "resourceType and resourceId required");
    }

    try {
      const tripId = await getTripIdFromResource(resourceType, resourceId);
      return ok({ tripId, resourceType, resourceId });
    } catch (error) {
      console.error("Get trip ID failed:", error);
      return bad(500, "Failed to get trip ID");
    }
  }

  return bad(404, "Route not found");
};
