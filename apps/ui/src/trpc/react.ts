"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from '../../../runtime/pkg/api/router';

export const trpc = createTRPCReact<AppRouter>();
