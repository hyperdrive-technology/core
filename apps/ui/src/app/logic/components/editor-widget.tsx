import * as React from "react";
import { PLCEditor } from "./plc-editor";

interface EditorWidgetProps {
  onUpdate?: () => void;
}

export function EditorWidget({ onUpdate }: EditorWidgetProps) {
  const handleChange = React.useCallback((code: string) => {
    console.log("Code changed:", code);
    if (onUpdate) {
      onUpdate();
    }
  }, [onUpdate]);

  return (
    <div className="h-full">
      <PLCEditor onChange={handleChange} />
    </div>
  );
}
