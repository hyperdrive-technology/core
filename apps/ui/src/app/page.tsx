import * as React from "react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          Inrush <span className="text-[hsl(280,100%,70%)]">PLC</span>
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
          <a
            className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
            href="/logic"
          >
            <h3 className="text-2xl font-bold">Logic Editor →</h3>
            <div className="text-lg">
              Program your PLC using IEC 61131-3 languages with a full-featured
              IDE.
            </div>
          </a>
          <a
            className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20"
            href="/scada"
          >
            <h3 className="text-2xl font-bold">SCADA →</h3>
            <div className="text-lg">
              Monitor and control your process with real-time visualization.
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}
