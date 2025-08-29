import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { Schema } from "../../data/resource";

// Configure Amplify
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

// Simplified response helpers
const ok = (body: any = {}) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
  },
  body: JSON.stringify(body),
});

const bad = (status = 400, message = "Bad Request") => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
  },
  body: JSON.stringify({ error: message }),
});

// Input validation schemas
const validateTripId = (id: string): boolean => {
  return typeof id === 'string' && id.length > 0 && id.length < 100;
};

const validateMaxUses = (maxUses: any): number => {
  const num = parseInt(maxUses);
  if (isNaN(num) || num < 1 || num > 1000) return 100; // Default
  return num;
};

// Rate limiting helper (simple in-memory for now)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const checkRateLimit = (userId: string, maxRequests = 5, windowMs = 60000): boolean => {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= maxRequests) {
    return false;
  }
  
  userLimit.count++;
  return true;
};

// Generate secure invite code
const generateInviteCode = (): string => {
  return randomBytes(16).toString('hex');
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    
    // Parse body with error handling
    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (parseError) {
        return bad(400, "Invalid JSON in request body");
      }
    }
    
    // Normalize path to avoid trailing slash mismatches
    const normalizedPath = (path || "").replace(/\/+$/, "");
    const methodUpper = (method || "").toUpperCase();
    
    // Get authenticated user
    const authz = (event.requestContext as any).authorizer as JwtCtx | undefined;
    const userId = authz?.jwt?.claims?.sub;
    
    if (!userId) {
      return bad(401, "Authentication required");
    }

  // POST /invite/create - Create shareable invitation link
  if (methodUpper === "POST" && normalizedPath.endsWith("/invite/create")) {
    const { tripId, maxUses } = body;
    
    // Input validation
    if (!validateTripId(tripId)) {
      return bad(400, "Invalid trip ID format");
    }
    
    const validatedMaxUses = validateMaxUses(maxUses);
    
    // Rate limiting
    if (!checkRateLimit(userId, 5, 60000)) {
      return bad(429, "Too many invite creation requests. Please wait a minute.");
    }
    
    try {
      // Check if user can create invites for this trip
      const trip = await client.models.Trip.get({ id: tripId });
      if (!trip.data || !trip.data.owners?.includes(userId)) {
        return bad(403, "You cannot create invitations for this trip");
      }

      // Check if there's an active invitation already
      const existingInvites = await client.models.TripInvite.list({
        filter: { 
          tripId: { eq: tripId }, 
          createdBy: { eq: userId },
          isActive: { eq: true }
        }
      });
      
      // If there's already an active invite, return it
      if (existingInvites.data && existingInvites.data.length > 0) {
        const existingInvite = existingInvites.data[0];
        
        // Check if it's still valid (not expired)
        if (new Date(existingInvite.expiresAt) > new Date()) {
          return ok({ 
            success: true, 
            inviteId: existingInvite.id,
            expiresAt: existingInvite.expiresAt,
            message: "Using existing active invitation"
          });
        }
      }

      // Generate secure invite code
      const secureInviteCode = generateInviteCode();

      // Create new shareable invitation with custom ID
      const invitation = await client.models.TripInvite.create({
        id: secureInviteCode,
        tripId,
        createdBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        maxUses: validatedMaxUses,
        usedCount: 0,
        usedBy: [],
        isActive: true,
      });

      console.log(`Secure invite created: ${invitation.data?.id} for trip ${tripId} by user ${userId}`);
      
      return ok({ 
        success: true, 
        inviteId: invitation.data?.id,
        expiresAt: invitation.data?.expiresAt,
        message: "Invitation link created successfully"
      });
      
    } catch (error) {
      console.error("Error creating invitation:", error);
      return bad(500, "Failed to create invitation link");
    }
  }

  // POST /invite/join - Join trip via shareable link
  if (methodUpper === "POST" && normalizedPath.endsWith("/invite/join")) {
    const { inviteId } = body;
    
    // Input validation
    if (!inviteId || typeof inviteId !== 'string' || inviteId.length < 10 || inviteId.length > 100) {
      return bad(400, "Invalid invite ID format");
    }
    
    // Rate limiting for join attempts
    if (!checkRateLimit(`join_${userId}`, 10, 60000)) {
      return bad(429, "Too many join attempts. Please wait a minute.");
    }
    
    try {
      // Get invitation
      const invite = await client.models.TripInvite.get({ id: inviteId });
      if (!invite.data) return bad(404, "Invitation not found");
      
      if (!invite.data.isActive) {
        return bad(409, "Invitation is no longer active");
      }
      
      if (new Date(invite.data.expiresAt) < new Date()) {
        // Deactivate expired invitation
        await client.models.TripInvite.update({
          id: inviteId,
          isActive: false
        });
        return bad(410, "Invitation has expired");
      }

      // Check if already used by this user
      if (invite.data.usedBy?.includes(userId)) {
        // Already joined, just return the trip ID
        return ok({ 
          success: true, 
          tripId: invite.data.tripId,
          message: "You're already a member of this trip!" 
        });
      }

      // Check max uses
      if (invite.data.maxUses && (invite.data.usedCount || 0) >= invite.data.maxUses) {
        await client.models.TripInvite.update({
          id: inviteId,
          isActive: false
        });
        return bad(409, "Invitation has reached maximum uses");
      }

      // Get trip and add user to owners
      const trip = await client.models.Trip.get({ id: invite.data.tripId });
      if (!trip.data) return bad(404, "Trip not found");
      
      const owners = [...(trip.data.owners || [])];
      if (!owners.includes(userId)) {
        owners.push(userId);
        
        await client.models.Trip.update({
          id: invite.data.tripId,
          owners
        });

        // Also grant access to existing Lists under this trip (append userId to owners arrays)
        const listsResp = await client.models.List.list({ filter: { tripId: { eq: invite.data.tripId } }, limit: 200 });
        const lists = listsResp.data ?? [];
        for (const list of lists) {
          const listOwners = [...(list.owners || [])];
          if (!listOwners.includes(userId)) {
            await client.models.List.update({ id: list.id!, owners: [...listOwners, userId] });
          }
        }
      }

      // Update invitation usage
      const usedBy = [...(invite.data.usedBy || [])];
      if (!usedBy.includes(userId)) {
        usedBy.push(userId);
        
        await client.models.TripInvite.update({
          id: inviteId,
          usedCount: (invite.data.usedCount || 0) + 1,
          usedBy
        });
      }

      console.log(`User ${userId} joined trip ${invite.data.tripId} via invite ${inviteId}`);
      
      return ok({ 
        success: true, 
        tripId: invite.data.tripId,
        tripName: trip.data.name,
        message: "Successfully joined trip!" 
      });
      
    } catch (error) {
      console.error("Error joining via invitation:", error);
      return bad(500, "Failed to join trip");
    }
  }

  // GET /invite/info - Get invitation info (for displaying before joining)
  if (methodUpper === "GET" && normalizedPath.endsWith("/invite/info")) {
    const inviteId = event.queryStringParameters?.inviteId;
    
    // Input validation
    if (!inviteId || typeof inviteId !== 'string' || inviteId.length < 10 || inviteId.length > 100) {
      return bad(400, "Invalid invite ID format");
    }
    
    try {
      // Get invitation details
      const invite = await client.models.TripInvite.get({ id: inviteId });
      if (!invite.data) return bad(404, "Invitation not found");
      
      if (!invite.data.isActive) {
        return bad(409, "Invitation is no longer active");
      }
      
      if (new Date(invite.data.expiresAt) < new Date()) {
        return bad(410, "Invitation has expired");
      }
      
      // Get trip info (without sensitive data)
      const trip = await client.models.Trip.get({ id: invite.data.tripId });
      if (!trip.data) return bad(404, "Trip not found");
      
      return ok({ 
        tripId: trip.data.id,
        tripName: trip.data.name,
        coverPhoto: trip.data.coverPhoto,
        memberCount: trip.data.owners?.length || 0,
        expiresAt: invite.data.expiresAt,
        alreadyMember: trip.data.owners?.includes(userId) || false
      });
      
    } catch (error) {
      console.error("Error getting invitation info:", error);
      return bad(500, "Failed to get invitation info");
    }
  }

  return bad(404, "Route not found");
  } catch (error) {
    console.error("Unhandled error in simple-invites:", error);
    return bad(500, "Internal server error");
  }
};
