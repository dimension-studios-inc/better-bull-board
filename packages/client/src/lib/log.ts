import { pino } from "pino"

import { createPinoJobLogDestination } from "./pino"

/** The client's own logger: stdout, plus the logs of the job bound to the current context. */
export const log = pino(
  { name: "better-bull-board" },
  pino.multistream([{ stream: process.stdout }, { stream: createPinoJobLogDestination() }]),
)
