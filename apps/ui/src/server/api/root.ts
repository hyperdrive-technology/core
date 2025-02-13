import { createTRPCRouter } from "~/server/api/trpc";
import { logicRouter } from "../logic/router";
import { plcRouter } from "./routers/plc";

export const appRouter = createTRPCRouter({
  plc: plcRouter,
  logic: logicRouter,
});

export type AppRouter = typeof appRouter;
