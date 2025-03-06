// app/client.tsx
/// <reference types="vinxi/types/client" />
import { StartClient } from '@tanstack/react-start';
import { hydrateRoot } from 'react-dom/client';
import { createAppRouter } from './router';

const router = createAppRouter();

hydrateRoot(document, <StartClient router={router} />);
