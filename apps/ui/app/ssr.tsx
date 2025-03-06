// app/ssr.tsx
import { getRouterManifest } from '@tanstack/react-start/router-manifest';
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';

import { createAppRouter } from './router';

export default createStartHandler({
  createRouter: createAppRouter,
  getRouterManifest,
})(defaultStreamHandler);
