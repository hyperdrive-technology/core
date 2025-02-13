"use client";

import { useState } from "react";
import { PLCEditor } from "~/components/plc/PLCEditor";
import { api } from "~/trpc/react";

export default function PLCPage() {
  const [currentProgram, setCurrentProgram] = useState("");
  const updateProgram = api.plc.updateProgram.useMutation();

  const handleProgramChange = async (code: string) => {
    setCurrentProgram(code);
    await updateProgram.mutateAsync({ code });
  };

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex h-16 items-center justify-between border-b bg-white px-4">
        <h1 className="text-2xl font-bold">PLC IDE</h1>
        <div className="flex items-center gap-4">
          <button
            className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
            onClick={() => handleProgramChange(currentProgram)}
          >
            Save
          </button>
          <button
            className="rounded bg-green-500 px-4 py-2 font-bold text-white hover:bg-green-700"
            onClick={() => {
              // TODO: Implement program download
            }}
          >
            Download
          </button>
        </div>
      </div>
      <div className="flex-1">
        <PLCEditor
          initialCode={currentProgram}
          onChange={handleProgramChange}
        />
      </div>
    </main>
  );
}
