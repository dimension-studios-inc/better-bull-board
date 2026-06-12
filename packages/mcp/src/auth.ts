import { timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

const BEARER_PREFIX = "Bearer ";

const timingSafeStringEqual = (actual: string, expected: string) => {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
};

export const isAuthorized = ({ headers, token }: { headers: IncomingHttpHeaders; token: string }) => {
  const authorization = headers.authorization;

  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return false;
  }

  const actualToken = authorization.slice(BEARER_PREFIX.length);
  return timingSafeStringEqual(actualToken, token);
};
