// Constants for API endpoints and configuration

import { HYPERDRIVE_PORT } from '../components/context/WebSocketContext';

// API endpoints
export const CONTROLLER_API_BASE_URL = `http://localhost:${HYPERDRIVE_PORT}`;
export const CONTROLLER_API = {
  DEPLOY: `${CONTROLLER_API_BASE_URL}/api/deploy`,
  COMPILE: `${CONTROLLER_API_BASE_URL}/api/compile`,
  VARIABLES: `${CONTROLLER_API_BASE_URL}/api/variables`,
  STATUS: `${CONTROLLER_API_BASE_URL}/api/status`,
  DOWNLOAD_AST: (path: string) =>
    `${CONTROLLER_API_BASE_URL}/api/download-ast/${encodeURIComponent(path)}`,
};
