import { fetchAuthSession } from "aws-amplify/auth";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    
    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(response.status, errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : 'Network error');
  }
}

// Invite-specific API calls
export const inviteApi = {
  async createInvite(tripId: string, maxUses?: number) {
    return apiCall('/invite/create', {
      method: 'POST',
      body: JSON.stringify({ tripId, maxUses }),
    });
  },

  async joinTrip(inviteId: string) {
    return apiCall('/invite/join', {
      method: 'POST',
      body: JSON.stringify({ inviteId }),
    });
  },

  async getInviteInfo(inviteId: string) {
    return apiCall(`/invite/info?inviteId=${encodeURIComponent(inviteId)}`);
  },
};