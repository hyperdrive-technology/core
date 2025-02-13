import * as React from "react";
import { api } from "~/trpc/react";

interface PLCEditorProps {
  initialCode?: string;
  onChange?: (code: string) => void;
}

export function PLCEditor({ initialCode = "", onChange }: PLCEditorProps) {
  const startServer = api.logic.startServer.useMutation();
  const stopServer = api.logic.stopServer.useMutation();

  React.useEffect(() => {
    // Start the Theia server when the component mounts
    startServer.mutate();

    // Stop the server when the component unmounts
    return () => {
      stopServer.mutate();
    };
  }, []);

  return (
    <div className="plc-editor-container h-full">
      <iframe
        src="http://localhost:3000"
        className="w-full h-full border-none"
        title="PLC Editor"
      />
    </div>
  );
}
