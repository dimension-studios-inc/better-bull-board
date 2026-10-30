import { pino } from "pino"

import { createPinoJobLogDestination } from "./pino"

/** The client's own logger: stdout, plus the logs of the job bound to the current context. */
export const log = pino(
  {
    name: "better-bull-board",
    // Log collectors such as Loki detect the level from its name, not from pino's number.
    formatters: { level: (label) => ({ level: label }) },
  },
  pino.multistream([
    // Sync, so a worker thread killed right after a cancellation keeps the line.
    { stream: pino.destination({ dest: 1, sync: true }) },
    { stream: createPinoJobLogDestination({ ignore: ["name"] }) },
  ]),
)
