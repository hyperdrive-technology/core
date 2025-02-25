import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/custom-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useState } from 'react';

interface StructuredTextEditorProps {
  projectId: string;
  initialCode: string;
  pouType: 'program' | 'functionBlock' | 'function';
  pouName: string;
  onSave: (code: string) => void;
}

export function StructuredTextEditor({
  projectId,
  initialCode,
  pouType,
  pouName,
  onSave,
}: StructuredTextEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [isEditing, setIsEditing] = useState(false);

  // Template generation based on POU type
  const generateTemplate = () => {
    if (pouType === 'program') {
      return `PROGRAM ${pouName}
VAR
  // Internal variables
END_VAR

(* Program logic *)

END_PROGRAM`;
    } else if (pouType === 'functionBlock') {
      return `FUNCTION_BLOCK ${pouName}
VAR_INPUT
  // Input variables
END_VAR

VAR_OUTPUT
  // Output variables
END_VAR

VAR
  // Internal variables
END_VAR

(* Function block logic *)

END_FUNCTION_BLOCK`;
    } else {
      return `FUNCTION ${pouName} : INT
VAR_INPUT
  // Input variables
END_VAR

VAR
  // Internal variables
END_VAR

(* Function logic *)
${pouName} := 0; // Return value

END_FUNCTION`;
    }
  };

  useEffect(() => {
    if (!initialCode) {
      setCode(generateTemplate());
    } else {
      setCode(initialCode);
    }
  }, [pouType, pouName, initialCode]);

  const handleSave = () => {
    onSave(code);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <CustomSelect
            value={pouType}
            options={[
              { value: 'program', label: 'PROGRAM' },
              { value: 'functionBlock', label: 'FUNCTION_BLOCK' },
              { value: 'function', label: 'FUNCTION' },
            ]}
            disabled={!isEditing}
          />
          <input
            type="text"
            value={pouName}
            className="border px-2 py-1 rounded"
            disabled={!isEditing}
          />
        </div>
        <div className="space-x-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Edit</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="code">
        <TabsList>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
        </TabsList>
        <TabsContent value="code" className="flex-1">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full font-mono p-4 border rounded"
            disabled={!isEditing}
          />
        </TabsContent>
        <TabsContent value="variables">
          {/* Variable editor component would go here */}
          <div className="p-4">Variable editor coming soon</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
