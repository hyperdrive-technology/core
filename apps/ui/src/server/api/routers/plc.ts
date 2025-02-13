import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type PLCValue } from "~/types/plc";

// Mock data for development
const mockTags: PLCValue[] = [
  {
    name: "Temperature",
    value: 25.5,
    quality: "good",
    timestamp: new Date().toISOString(),
  },
  {
    name: "Pressure",
    value: 1013.25,
    quality: "good",
    timestamp: new Date().toISOString(),
  },
  {
    name: "Flow",
    value: 100,
    quality: "good",
    timestamp: new Date().toISOString(),
  },
];

export const plcRouter = createTRPCRouter({
  getTags: publicProcedure.query(() => {
    // TODO: Implement actual PLC tag fetching
    return mockTags;
  }),

  subscribeToTags: publicProcedure
    .input(z.object({ tags: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      // TODO: Implement WebSocket subscription
      console.log("Subscribing to tags:", input.tags);
      return true;
    }),

  updateProgram: publicProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input }) => {
      // TODO: Implement program update
      console.log("Updating program:", input.code);
      return true;
    }),

  writeTag: publicProcedure
    .input(z.object({
      name: z.string(),
      value: z.union([z.number(), z.boolean(), z.string()]),
    }))
    .mutation(async ({ input }) => {
      // TODO: Implement tag write
      console.log("Writing tag:", input.name, input.value);
      return true;
    }),
});
