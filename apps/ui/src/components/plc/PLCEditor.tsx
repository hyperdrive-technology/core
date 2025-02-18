import * as React from "react";
import { api } from "~/trpc/react";

interface PLCEditorProps {
  initialCode?: string;
  onChange?: (code: string) => void;
}

export function PLCEditor({ initialCode = "", onChange }: PLCEditorProps) {
  const startServer = api.logic.startServer.useMutation();
  const stopServer = api.logic.stopServer.useMutation();

  // Handle code changes
  const handleCodeChange = React.useCallback(
    (newCode: string) => {
      if (onChange) {
        onChange(newCode);
      }
    },
    [onChange],
  );

  // Set initial code
  React.useEffect(() => {
    if (initialCode) {
      handleCodeChange(initialCode);
    }
  }, [initialCode, handleCodeChange]);

  // Start/stop server
  React.useEffect(() => {
    void startServer.mutateAsync();

    return () => {
      void stopServer.mutateAsync();
    };
  }, [startServer, stopServer]);

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
