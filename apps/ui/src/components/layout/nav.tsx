import * as React from "react";

interface NavProps {
  currentPath: string;
}

export function Nav({ currentPath }: NavProps) {
  return (
    <nav className="flex h-16 items-center justify-between bg-white px-4 shadow-sm">
      <div className="flex items-center gap-8">
        <a href="/" className="text-2xl font-bold text-gray-900">
          Inrush
        </a>
        <div className="flex gap-4">
          <a
            href="/logic"
            className={currentPath === "/logic" ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}
          >
            Logic Editor
          </a>
          <a
            href="/scada"
            className={currentPath === "/scada" ? "text-blue-600 font-medium" : "text-gray-600 hover:text-gray-900"}
          >
            SCADA
          </a>
        </div>
      </div>
    </nav>
  );
}
