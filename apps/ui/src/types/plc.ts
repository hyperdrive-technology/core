export type Quality = "good" | "bad" | "uncertain";

export interface PLCValue {
  name: string;
  value: string | number | boolean;
  quality: string;
  timestamp: number;
}

export interface PLCProgram {
  name: string;
  code: string;
  version: string;
  modified: string;
}

export interface PLCVariable {
  name: string;
  dataType: "bool" | "int" | "float" | "string";
  value: number | boolean | string;
  quality: Quality;
  timestamp: string;
}

export interface PLCTask {
  name: string;
  interval: number;
  priority: number;
}

export interface PLCVersion {
  id: string;
  timestamp: string;
  state: "active" | "testing" | "pending" | "archived";
  program: PLCProgram;
  parentId?: string;
}
