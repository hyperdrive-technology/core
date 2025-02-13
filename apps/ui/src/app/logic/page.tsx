import { Nav } from "~/components/layout/nav";
import { EditorWidget } from "./components/editor-widget";

export default function LogicPage() {
  return (
    <div className="flex flex-col h-screen">
      <Nav currentPath="/logic" />
      <div className="flex-1">
        <EditorWidget />
      </div>
    </div>
  );
}
