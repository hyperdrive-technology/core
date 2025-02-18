import { useEffect, useMemo, useState } from "react";
import { PLCClient } from "~/lib/plc-client";
import { type PLCValue } from "~/types/plc";

let globalClient: PLCClient | null = null;

export function usePLCClient() {
  const client = useMemo(() => {
    if (!globalClient) {
      globalClient = new PLCClient();
      globalClient.connect();
    }
    return globalClient;
  }, []);

  useEffect(() => {
    return () => {
      // Only disconnect if there are no other subscribers
      if (globalClient && document.visibilityState === "hidden") {
        globalClient.disconnect();
        globalClient = null;
      }
    };
  }, []);

  return client;
}

export function usePLCSubscription(tags: string[]) {
  const client = usePLCClient();
  const [values, setValues] = useState<PLCValue[]>([]);
  const tagsKey = tags.join(",");

  useEffect(() => {
    const unsubscribe = client.subscribe(tagsKey, tags, (newValues) =>
      setValues((prev) => {
        const updated = new Map(prev.map((v) => [v.name, v]));
        for (const value of newValues) {
          updated.set(value.name, value);
        }
        return Array.from(updated.values());
      }),
    );

    return () => {
      unsubscribe();
    };
  }, [client, tagsKey, tags]);

  return values;
}

export function usePLCTag(tag: string) {
  const values = usePLCSubscription([tag]);
  return values[0];
}

export function usePLCWrite() {
  const client = usePLCClient();
  return (tag: string, value: number | boolean | string) => {
    client.writeTag(tag, value);
  };
}
