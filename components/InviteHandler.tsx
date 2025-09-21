import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { getTripInviteInfo, joinTripInvite } from '../lib/appsyncApi';
import { useAuth } from '../providers/AuthProvider';
import { ErrorHandler, withRetry } from '../utils/errorHandling';

interface InviteHandlerProps {
  inviteId?: string;
}

export default function InviteHandler({ inviteId }: InviteHandlerProps) {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const router = useRouter();
  const { user, tokens } = useAuth();
  const lastProcessedInviteRef = useRef<string | null>(null);

  useEffect(() => {
    const maybeInviteIdFromPath = pathname && pathname.includes('/invite/')
      ? pathname.split('/invite/')[1]
      : null;

    const inviteIdFromParams = typeof params.inviteId === 'string' ? params.inviteId : null;

    const candidate = inviteId ?? maybeInviteIdFromPath ?? inviteIdFromParams;

    if (!candidate || candidate === lastProcessedInviteRef.current) {
      return;
    }

    lastProcessedInviteRef.current = candidate;
    handleInvite(candidate);
  }, [inviteId, pathname, params]);

  const handleInvite = async (inviteCode: string) => {
    if (!user) {
      Alert.alert(
        'Sign in required',
        'Please sign in to join a trip.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Sign In',
            onPress: () => {
              router.push('/auth');
            },
          },
        ]
      );
      return;
    }

    try {
      const inviteInfoWithRetry = withRetry(async () => {
        return await getTripInviteInfo(inviteCode, tokens ?? null);
      }, `invite-info-${inviteCode}`, 'loading invite information');

      const inviteInfo = await inviteInfoWithRetry();

      if (!inviteInfo.invite || !inviteInfo.trip) {
        Alert.alert('Invalid Invite', 'This invitation is not valid or has been removed.');
        return;
      }

      const { invite, trip } = inviteInfo;

      if (inviteInfo.status && inviteInfo.status !== 'ACTIVE') {
        Alert.alert('Invite Unavailable', `This invitation is ${inviteInfo.status.toLowerCase()}.`);
        return;
      }

      if (invite.usedBy?.includes(user.sub)) {
        Alert.alert('Already Used', 'You have already used this invitation.');
        return;
      }

      if (trip.owners?.includes(user.sub)) {
        Alert.alert('Already a Member', `You are already a member of "${trip.name}".`, [
          {
            text: 'View Trip',
            onPress: () => router.push({ pathname: '/(tabs)/trip/[trip]', params: { trip: trip.id } }),
          },
          { text: 'OK', style: 'cancel' },
        ]);
        return;
      }

      Alert.alert(
        'Join Trip',
        `Would you like to join "${trip.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Join',
            onPress: async () => {
              try {
                const joinTripWithRetry = withRetry(async () => {
                  return await joinTripInvite({ inviteId: inviteCode }, tokens ?? null);
                }, `join-trip-${inviteCode}`, 'joining trip');

                const joinedTrip = await joinTripWithRetry();

                Alert.alert('Welcome!', `You have joined "${joinedTrip.name}"!`, [
                  {
                    text: 'View Trip',
                    onPress: () => router.push({ pathname: '/(tabs)/trip/[trip]', params: { trip: joinedTrip.id } }),
                  },
                  { text: 'OK' },
                ]);
              } catch (error: any) {
                ErrorHandler.showError(error, 'Join Failed', 'joining trip');
              }
            },
          },
        ]
      );
    } catch (error: any) {
      ErrorHandler.showError(error, 'Invalid Invite', 'processing invitation');
    }
  };

  return null;
}
