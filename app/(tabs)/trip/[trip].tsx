import { Amplify, API } from "aws-amplify";
import { getCurrentUser } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import { parseAmplifyConfig } from "aws-amplify/utils";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import type { Schema } from "../../../amplify/data/resource";
import outputs from "../../../amplify_outputs.json";

// Configure Amplify (includes REST mapping for our HTTP API)
const cfg = parseAmplifyConfig(outputs);
Amplify.configure(
  { ...cfg, API: { ...cfg.API, REST: (outputs as any).custom?.API } },
);

const client = generateClient<Schema>();

export default function TripScreen() {
  const { tripId, invite } = useLocalSearchParams<{ tripId: string; invite?: string }>();
  const [userSub, setUserSub] = useState<string | null>(null);
  const [items, setItems] = useState<Schema["ListItem"]["type"][]>([]);
  const [loading, setLoading] = useState(true);

  // Redeem invite on first open (after sign-in)
  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setUserSub(u.userId);

      if (invite) {
        try {
          await API.post("app-api", "/invites/redeem", {
            body: { token: invite },
          });
        } catch (e: any) {
          console.warn("redeem failed", e?.message || e);
        }
      }

      await refresh();
      subscribe();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    // Load lists for this trip, then load items (simple example assumes one list per trip)
    const lists = await client.models.List.list({ filter: { tripId: { eq: tripId as string } } });
    const listId = lists.data?.[0]?.id;
    if (!listId) { setItems([]); setLoading(false); return; }

    const { data } = await client.models.ListItem.list({
      filter: { listId: { eq: listId } },
      limit: 200,
    });
    setItems(data ?? []);
    setLoading(false);
  }

  // Live updates (realtime subscriptions)
  function subscribe() {
    const sub = client.models.ListItem.observeQuery({
      // observeQuery keeps a live cache for your filter; switch to .subscribe for raw events
      filter: { listId: { eq: tripId as string } } as any,
    }).subscribe(({ items }) => setItems(items));
    return () => sub.unsubscribe();
  }

  async function toggleLike(item: Schema["ListItem"]["type"]) {
    if (!userSub) return;
    const liked = new Set(item.likedBy ?? []);
    const has = liked.has(userSub);

    // Optimistic UI
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              likedBy: has ? [...liked].filter((s) => s !== userSub) : [...liked, userSub],
              voteCount: (it.voteCount ?? 0) + (has ? -1 : 1),
            }
          : it
      )
    );

    try {
      await client.models.ListItem.update({
        id: item.id,
        likedBy: has ? (item.likedBy ?? []).filter((s) => s !== userSub) : [...(item.likedBy ?? []), userSub],
        voteCount: (item.voteCount ?? 0) + (has ? -1 : 1),
      });
    } catch (e) {
      Alert.alert("Failed to update like");
      // revert if needed (keep simple here)
      refresh();
    }
  }

  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 12, borderBottomWidth: 0.5 }}>
            <Text style={{ fontWeight: "600" }}>{item.title ?? item.placeId}</Text>
            <Text style={{ opacity: 0.7 }}>{item.note ?? ""}</Text>
            <Pressable onPress={() => toggleLike(item)} style={{ marginTop: 8 }}>
              <Text>👍 {item.voteCount ?? 0}</Text>
            </Pressable>
          </View>
        )}
      />
      {/* Remember Google attribution wherever you show place details */}
      <Text style={{ textAlign: "center", marginTop: 8, fontSize: 12 }}>Powered by Google</Text>
    </View>
  );
}