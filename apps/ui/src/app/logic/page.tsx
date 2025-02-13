import * as React from "react";
import { Nav } from "~/components/layout/nav";

export default function LogicPage() {
  return (
    <div className="flex flex-col h-screen">
      <Nav currentPath="/logic" />
      <div className="flex-1">
        <iframe
          src="http://localhost:3000"
          className="w-full h-full border-none"
          title="Theia IDE"
        />
      </div>
    </div>
  );
}
