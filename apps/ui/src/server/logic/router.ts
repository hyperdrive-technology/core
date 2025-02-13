import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TheiaServer } from "./theia-server";

const theiaServer = new TheiaServer();

export const logicRouter = createTRPCRouter({
  startServer: publicProcedure.mutation(async () => {
    theiaServer.start();
    return true;
  }),

  stopServer: publicProcedure.mutation(async () => {
    theiaServer.stop();
    return true;
  }),

  updateProgram: publicProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input }) => {
      // TODO: Implement program update through Theia
      console.log("Updating program:", input.code);
      return true;
    }),
});
