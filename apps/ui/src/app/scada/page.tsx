"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Nav } from "~/components/layout/nav";
import { api } from "~/trpc/react";
import { type PLCValue } from "~/types/plc";

export default function SCADAPage() {
  const [tags, setTags] = useState<PLCValue[]>([]);
  const getTags = api.plc.getTags.useQuery();
  const subscribeToTags = api.plc.subscribeToTags.useMutation();

  useEffect(() => {
    if (getTags.data) {
      setTags(getTags.data);
      void subscribeToTags.mutateAsync({
        tags: getTags.data.map(tag => tag.name)
      });
    }
  }, [getTags.data]);

  return (
    <main className="flex min-h-screen flex-col">
      <Nav currentPath="/scada" />
      <div className="flex h-16 items-center justify-end bg-white px-4 border-b">
        <button
          className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
          onClick={() => {
            // TODO: Implement layout editor
          }}
        >
          Edit Layout
        </button>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {tags.map((tag) => (
          <div
            key={tag.name}
            className="rounded-lg border bg-white p-4 shadow-sm"
          >
            <h3 className="text-lg font-semibold">{tag.name}</h3>
            <div className="mt-2 text-2xl font-bold">{tag.value}</div>
            <div className="mt-1 text-sm text-gray-500">
              Quality: {tag.quality}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Updated: {new Date(tag.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
