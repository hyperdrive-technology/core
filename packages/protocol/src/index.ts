export interface PLCValue {
  tag: string;
  value: any;
  timestamp: string;
  quality: Quality;
}

export enum Quality {
  Good = 'good',
  Bad = 'bad',
  Uncertain = 'uncertain'
}

export enum DataType {
  Bool = 'bool',
  Int = 'int',
  Float = 'float',
  String = 'string'
}

export interface Variable {
  name: string;
  dataType: DataType;
  value: any;
  quality: Quality;
  timestamp: string;
}

export interface Task {
  name: string;
  interval: number;
  priority: number;
}

export interface Program {
  name: string;
  code: string;
  version: string;
  modified: string;
}

export interface Version {
  id: string;
  timestamp: string;
  state: VersionState;
  program: Program;
  parentId?: string;
}

export enum VersionState {
  Active = 'active',
  Testing = 'testing',
  Pending = 'pending',
  Archived = 'archived'
}

// WebSocket Messages
export interface WebSocketMessage {
  type: MessageType;
  action?: string;
  payload?: any;
}

export enum MessageType {
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
  Write = 'write',
  Update = 'update',
  OnlineChange = 'onlineChange'
}

export interface SubscribeMessage extends WebSocketMessage {
  type: MessageType.Subscribe;
  payload: {
    tags: string[];
  };
}

export interface WriteMessage extends WebSocketMessage {
  type: MessageType.Write;
  payload: {
    tag: string;
    value: any;
  };
}

export interface UpdateMessage extends WebSocketMessage {
  type: MessageType.Update;
  payload: PLCValue[];
}

export interface OnlineChangeMessage extends WebSocketMessage {
  type: MessageType.OnlineChange;
  action: 'startTest' | 'acceptChanges' | 'discardChanges';
  payload?: {
    program?: Program;
  };
}
