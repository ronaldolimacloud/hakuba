// app/currency.tsx
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";

type Cur = { code: string; name: string; flag: string };

// Edit this list to your taste
const CURRENCIES: Cur[] = [
  { code: "AUD", name: "Australian Dollar", flag: "🇦🇺" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "USD", name: "United States Dollar", flag: "🇺🇸" },
];

export default function CurrencyScreen() {
  // "Base" currency whose amount the user entered last
  const [base, setBase] = useState<Cur>(CURRENCIES.find(c => c.code === "USD")!);
  const [amount, setAmount] = useState<number>(1);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [ratesDate, setRatesDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [pendingBase, setPendingBase] = useState<Cur | null>(null);
  const [input, setInput] = useState<string>("1");

  // Format numbers as real currencies in the user locale
  const format = (value: number, currency: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

  // Convert the list display
  const displayRows = useMemo(() => {
    return CURRENCIES.map((c) => {
      if (c.code === base.code) {
        return { ...c, valueText: format(amount, c.code), isBase: true };
      }
      const rate = rates?.[c.code];
      const v = typeof rate === "number" ? amount * rate : null;
      return { ...c, valueText: v != null ? format(v, c.code) : "—", isBase: false };
    });
  }, [amount, base, rates]);

  function openAmountModal(currency: Cur) {
    setPendingBase(currency);
    // Pre-fill with last used amount if tapping the same base; else default “1”
    setInput(currency.code === base.code ? String(amount) : "1");
    setShowModal(true);
  }

  function append(d: string) {
    setInput((prev) => {
      if (d === ".") {
        if (prev.includes(".")) return prev;
        return prev.length ? prev + "." : "0.";
      }
      // digits
      if (prev === "0") return d; // avoid leading zeroes
      return prev + d;
    });
  }
  function backspace() {
    setInput((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
  }
  function quickSet(n: number | string) {
    setInput(String(n));
  }

  async function onConvert() {
    try {
      const b = pendingBase!;
      const amt = Number(input.replace(/[, ]/g, ""));
      if (!Number.isFinite(amt) || amt < 0) {
        Alert.alert("Invalid amount", "Please enter a valid number.");
        return;
      }

      setLoading(true);

      const symbols = CURRENCIES.map((c) => c.code).filter((c) => c !== b.code).join(",");
      // Frankfurter (ECB reference). No key. Daily rates.
      const url = `https://api.frankfurter.app/latest?base=${encodeURIComponent(
        b.code
      )}&symbols=${encodeURIComponent(symbols)}`;

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      setRates(json.rates as Record<string, number>);
      setRatesDate(json.date as string);
      setBase(b);
      setAmount(amt);
      setShowModal(false);
    } catch (e: any) {
      Alert.alert("Conversion failed", String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0c0c0c" }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "700" }}>Currency</Text>
        {!!ratesDate && (
          <Text style={{ color: "#8a8a8a", marginTop: 4, fontSize: 12 }}>
            Rates date: {ratesDate} • Source: Frankfurter (ECB)
          </Text>
        )}
      </View>

      <FlatList
        data={displayRows}
        keyExtractor={(item) => item.code}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#202020" }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openAmountModal({ code: item.code, name: item.name, flag: item.flag })}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              backgroundColor: item.isBase ? "#0f1a0f" : "transparent",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 24 }}>{item.flag}</Text>
              <View>
                <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
                <Text style={{ color: "#9b9b9b", fontSize: 12 }}>{item.code}</Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: "#1b4d1b",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                minWidth: 96,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#b6ffb6", fontWeight: "700" }}>{item.valueText}</Text>
            </View>
          </Pressable>
        )}
      />

      {loading && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator color={"#7aff7a"} />
        </View>
      )}

      {/* Modal keypad */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#3a1f22" }}>
          {/* Header */}
          <View style={{ padding: 16, flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 28 }}>{pendingBase?.flag}</Text>
              <View>
                <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
                  {pendingBase?.name}
                </Text>
                <Text style={{ color: "#e0c7c9" }}>{pendingBase?.code}</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowModal(false)}
              hitSlop={10}
              style={{
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            >
              <Text style={{ color: "white", fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TextInput
              editable={false}
              value={input}
              style={{
                fontSize: 42,
                color: "white",
                fontWeight: "800",
                letterSpacing: 1,
              }}
            />
          </View>

          {/* Keypad */}
          <View style={{ flex: 1, flexDirection: "row", padding: 16, gap: 16 }}>
            {/* Left: digits */}
            <View style={{ flex: 1, gap: 12 }}>
              {[
                ["7", "8", "9"],
                ["4", "5", "6"],
                ["1", "2", "3"],
                ["0", ".", "⌫"],
              ].map((row, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 12 }}>
                  {row.map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => {
                        if (k === "⌫") backspace();
                        else append(k);
                      }}
                      style={{
                        flex: 1,
                        height: 64,
                        borderRadius: 32,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(255,255,255,0.12)",
                      }}
                    >
                      <Text style={{ color: "white", fontSize: 22, fontWeight: "700" }}>{k}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>

            {/* Right: quick chips */}
            <View style={{ width: 84, gap: 12 }}>
              {["1e3", "100", "10", "1"].map((lab) => (
                <Pressable
                  key={lab}
                  onPress={() => quickSet(Number(lab.replace("e3", "000")))}
                  style={{
                    height: 64,
                    borderRadius: 32,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.35)",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>{lab}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            onPress={onConvert}
            style={{
              margin: 16,
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: "center",
              backgroundColor: "#20c020",
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ color: "white", fontSize: 18, fontWeight: "800", letterSpacing: 0.5 }}>
              ⇄  CONVERT
            </Text>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
