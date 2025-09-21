export interface Trip {
  id: string;
  name: string;
  owners: string[];
  admins?: string[] | null;
  coverPhoto?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: string;
  tripId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListItem {
  id: string;
  listId: string;
  title: string;
  note?: string | null;
  voteCount: number;
  likedBy?: string[] | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  placeId?: string | null;
  placeName?: string | null;
  placeAddress?: string | null;
  placeTypes?: string[] | null;
  placeRating?: number | null;
  placePhotoReference?: string | null;
  placePhotoUrl?: string | null;
}

export interface Comment {
  id: string;
  itemId: string;
  body: string;
  authorId: string;
  createdAt: string;
}

export interface TripInvite {
  id: string;
  tripId: string;
  createdBy: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  usedBy?: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InviteInfo {
  invite?: TripInvite | null;
  trip?: Trip | null;
  status: 'ACTIVE' | 'EXPIRED' | 'INACTIVE' | 'CONSUMED' | 'INVALID';
}
