import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

export const instanceId = `${hostname()}-${process.pid}-${randomUUID()}`;
