import { createHash, randomBytes } from "node:crypto";
import { mcpOAuthAuthorizationCodesTable, mcpOAuthClientsTable, mcpOAuthTokensTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { MCP_READ_SCOPE, MCP_SUPPORTED_SCOPES } from "@better-bull-board/mcp/scopes";
import { and, eq, gt, isNull } from "drizzle-orm";

export const MCP_ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const MCP_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
const MCP_AUTHORIZATION_CODE_TTL_SECONDS = 60 * 10;

type TokenIssuerDatabase = Pick<typeof db, "insert">;

export class OAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const firstHeaderValue = (value: string | null) => value?.split(",")[0]?.trim() || null;

const inferProtocol = (host: string) =>
  host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";

const isHttpProtocol = (protocol: string | null) => protocol === "http" || protocol === "https";

export const getOriginFromHeaders = (headers: Headers, fallbackOrigin = "http://localhost") => {
  const host = firstHeaderValue(headers.get("x-forwarded-host")) ?? firstHeaderValue(headers.get("host"));

  if (!host) {
    return fallbackOrigin;
  }

  const forwardedProtocol = firstHeaderValue(headers.get("x-forwarded-proto"));
  const protocol = isHttpProtocol(forwardedProtocol) ? forwardedProtocol : inferProtocol(host);

  return `${protocol}://${host}`;
};

export const getOrigin = (request: Request) => {
  return getOriginFromHeaders(request.headers, new URL(request.url).origin);
};

export const getMcpResource = (origin: string) => `${origin}/mcp`;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

const validateRedirectUri = (redirectUri: string) => {
  let url: URL;

  try {
    url = new URL(redirectUri);
  } catch {
    throw new OAuthError("invalid_client_metadata", "redirect_uris must contain absolute URIs");
  }

  if (url.hash) {
    throw new OAuthError("invalid_client_metadata", "redirect_uris must not contain fragments");
  }

  const scheme = url.protocol.toLowerCase();
  const blockedSchemes = new Set(["data:", "file:", "javascript:", "vbscript:"]);
  const isAllowedScheme = scheme === "http:" || scheme === "https:" || /^[a-z][a-z0-9+.-]*:$/.test(scheme);

  if (!isAllowedScheme || blockedSchemes.has(scheme)) {
    throw new OAuthError("invalid_client_metadata", "redirect_uris use an unsupported scheme");
  }

  return url.toString();
};

const parseScopes = (scope?: string | null) => {
  const requestedScopes = new Set((scope ?? MCP_READ_SCOPE).split(/\s+/).filter(Boolean));
  const unsupportedScopes = [...requestedScopes].filter(
    (requestedScope) => !MCP_SUPPORTED_SCOPES.includes(requestedScope as (typeof MCP_SUPPORTED_SCOPES)[number]),
  );

  if (unsupportedScopes.length > 0) {
    throw new OAuthError("invalid_scope", `Unsupported scope: ${unsupportedScopes.join(" ")}`);
  }

  if (!requestedScopes.has(MCP_READ_SCOPE)) {
    throw new OAuthError("invalid_scope", "bbb:read is required");
  }

  return MCP_SUPPORTED_SCOPES.filter((supportedScope) => requestedScopes.has(supportedScope)).join(" ");
};

const requireString = (formData: FormData, key: string) => {
  const value = formData.get(key);

  if (typeof value !== "string" || value.length === 0) {
    throw new OAuthError("invalid_request", `${key} is required`);
  }

  return value;
};

export const createOAuthErrorRedirect = ({
  redirectUri,
  error,
  description,
  state,
}: {
  redirectUri: string;
  error: string;
  description?: string;
  state?: string | null;
}) => {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (description) {
    url.searchParams.set("error_description", description);
  }
  if (state) {
    url.searchParams.set("state", state);
  }
  return url;
};

export const normalizeClientRegistration = async (body: unknown) => {
  const metadata = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const redirectUris = Array.isArray(metadata.redirect_uris)
    ? metadata.redirect_uris
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map(validateRedirectUri)
    : [];

  if (redirectUris.length === 0) {
    throw new OAuthError("invalid_client_metadata", "redirect_uris is required");
  }

  const grantTypes = Array.isArray(metadata.grant_types)
    ? metadata.grant_types.filter((value): value is string => typeof value === "string")
    : ["authorization_code", "refresh_token"];
  const responseTypes = Array.isArray(metadata.response_types)
    ? metadata.response_types.filter((value): value is string => typeof value === "string")
    : ["code"];
  const tokenEndpointAuthMethod =
    typeof metadata.token_endpoint_auth_method === "string" ? metadata.token_endpoint_auth_method : "none";
  const clientName =
    typeof metadata.client_name === "string" && metadata.client_name.length > 0 ? metadata.client_name : "MCP Client";
  const scope = parseScopes(typeof metadata.scope === "string" ? metadata.scope : undefined);

  if (!grantTypes.includes("authorization_code")) {
    throw new OAuthError("invalid_client_metadata", "authorization_code grant is required");
  }
  if (!responseTypes.includes("code")) {
    throw new OAuthError("invalid_client_metadata", "code response type is required");
  }
  if (tokenEndpointAuthMethod !== "none" && tokenEndpointAuthMethod !== "client_secret_post") {
    throw new OAuthError("invalid_client_metadata", "Unsupported token_endpoint_auth_method");
  }

  const clientId = randomToken(24);
  const clientSecret = tokenEndpointAuthMethod === "client_secret_post" ? randomToken(32) : undefined;

  await db.insert(mcpOAuthClientsTable).values({
    clientId,
    clientSecretHash: clientSecret ? hashToken(clientSecret) : null,
    clientName,
    redirectUris,
    grantTypes,
    responseTypes,
    tokenEndpointAuthMethod,
    scope,
    metadata,
  });

  return {
    client_id: clientId,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: tokenEndpointAuthMethod,
    scope,
  };
};

export const getClient = async (clientId: string) => {
  const [client] = await db.select().from(mcpOAuthClientsTable).where(eq(mcpOAuthClientsTable.clientId, clientId));
  return client ?? null;
};

export const validateClientSecret = (
  client: NonNullable<Awaited<ReturnType<typeof getClient>>>,
  clientSecret?: string,
) => {
  if (client.tokenEndpointAuthMethod === "none") {
    return;
  }

  if (!client.clientSecretHash || !clientSecret || hashToken(clientSecret) !== client.clientSecretHash) {
    throw new OAuthError("invalid_client", "Invalid client credentials", 401);
  }
};

export const validateAuthorizationRequest = async (url: URL, options?: { expectedResource?: string }) => {
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "plain";
  const scope = parseScopes(url.searchParams.get("scope"));
  const state = url.searchParams.get("state");
  const resource = url.searchParams.get("resource") ?? getMcpResource(url.origin);
  const expectedResource = options?.expectedResource ?? getMcpResource(url.origin);

  if (responseType !== "code") {
    throw new OAuthError("unsupported_response_type", "Only authorization code flow is supported");
  }
  if (!clientId || !redirectUri || !codeChallenge) {
    throw new OAuthError("invalid_request", "client_id, redirect_uri, and code_challenge are required");
  }
  if (codeChallengeMethod !== "S256" && codeChallengeMethod !== "plain") {
    throw new OAuthError("invalid_request", "Only S256 and plain PKCE methods are supported");
  }
  if (resource !== expectedResource) {
    throw new OAuthError(
      "invalid_target",
      "This authorization server only issues tokens for the Better Bull Board MCP resource",
    );
  }

  const client = await getClient(clientId);
  if (!client) {
    throw new OAuthError("invalid_client", "Unknown OAuth client");
  }
  if (!client.redirectUris.includes(redirectUri)) {
    throw new OAuthError("invalid_request", "redirect_uri is not registered for this client");
  }

  return { client, redirectUri, scope, state, codeChallenge, codeChallengeMethod, resource };
};

export const createAuthorizationCode = async ({
  clientId,
  redirectUri,
  scope,
  codeChallenge,
  codeChallengeMethod,
  resource,
  subject,
}: {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  subject: string;
}) => {
  const code = randomToken(32);
  const expiresAt = new Date(Date.now() + MCP_AUTHORIZATION_CODE_TTL_SECONDS * 1000);

  await db.insert(mcpOAuthAuthorizationCodesTable).values({
    codeHash: hashToken(code),
    clientId,
    redirectUri,
    scope,
    codeChallenge,
    codeChallengeMethod,
    resource,
    subject,
    expiresAt,
  });

  return code;
};

const verifyPkce = (codeVerifier: string, codeChallenge: string, method: string) => {
  const actual = method === "S256" ? createHash("sha256").update(codeVerifier).digest("base64url") : codeVerifier;

  return actual === codeChallenge;
};

const issueTokens = async ({
  clientId,
  database = db,
  subject,
  scope,
  resource,
}: {
  clientId: string;
  database?: TokenIssuerDatabase;
  subject: string;
  scope: string;
  resource: string;
}) => {
  const accessToken = randomToken(32);
  const refreshToken = randomToken(32);
  const accessTokenExpiresAt = new Date(Date.now() + MCP_ACCESS_TOKEN_TTL_SECONDS * 1000);
  const refreshTokenExpiresAt = new Date(Date.now() + MCP_REFRESH_TOKEN_TTL_SECONDS * 1000);

  const [row] = await database
    .insert(mcpOAuthTokensTable)
    .values({
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      clientId,
      subject,
      scope,
      resource,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    })
    .returning({ id: mcpOAuthTokensTable.id });

  if (!row) {
    throw new OAuthError("server_error", "Failed to issue MCP token", 500);
  }

  return {
    rowId: row.id,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
    scope,
  };
};

export const exchangeAuthorizationCode = async (formData: FormData) => {
  const clientId = requireString(formData, "client_id");
  const client = await getClient(clientId);
  if (!client) {
    throw new OAuthError("invalid_client", "Unknown OAuth client", 401);
  }

  validateClientSecret(client, formData.get("client_secret")?.toString());

  const code = requireString(formData, "code");
  const redirectUri = requireString(formData, "redirect_uri");
  const codeVerifier = requireString(formData, "code_verifier");
  const resource = formData.get("resource")?.toString();

  return db.transaction(async (tx) => {
    const [authorizationCode] = await tx
      .update(mcpOAuthAuthorizationCodesTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(mcpOAuthAuthorizationCodesTable.codeHash, hashToken(code)),
          eq(mcpOAuthAuthorizationCodesTable.clientId, clientId),
          eq(mcpOAuthAuthorizationCodesTable.redirectUri, redirectUri),
          isNull(mcpOAuthAuthorizationCodesTable.usedAt),
          gt(mcpOAuthAuthorizationCodesTable.expiresAt, new Date()),
        ),
      )
      .returning();

    if (!authorizationCode) {
      throw new OAuthError("invalid_grant", "Authorization code is invalid or expired");
    }
    if (resource && authorizationCode.resource !== resource) {
      throw new OAuthError("invalid_target", "Authorization code was issued for a different resource");
    }
    if (!verifyPkce(codeVerifier, authorizationCode.codeChallenge, authorizationCode.codeChallengeMethod)) {
      throw new OAuthError("invalid_grant", "PKCE verification failed");
    }

    return issueTokens({
      clientId,
      database: tx,
      subject: authorizationCode.subject,
      scope: authorizationCode.scope,
      resource: authorizationCode.resource,
    });
  });
};

export const exchangeRefreshToken = async (formData: FormData) => {
  const clientId = requireString(formData, "client_id");
  const client = await getClient(clientId);
  if (!client) {
    throw new OAuthError("invalid_client", "Unknown OAuth client", 401);
  }

  validateClientSecret(client, formData.get("client_secret")?.toString());

  const refreshToken = requireString(formData, "refresh_token");
  return db.transaction(async (tx) => {
    const now = new Date();
    const [token] = await tx
      .update(mcpOAuthTokensTable)
      .set({ revokedAt: now, rotatedAt: now })
      .where(
        and(
          eq(mcpOAuthTokensTable.refreshTokenHash, hashToken(refreshToken)),
          eq(mcpOAuthTokensTable.clientId, clientId),
          isNull(mcpOAuthTokensTable.revokedAt),
          gt(mcpOAuthTokensTable.refreshTokenExpiresAt, now),
        ),
      )
      .returning();

    if (!token) {
      throw new OAuthError("invalid_grant", "Refresh token is invalid or expired");
    }

    const issued = await issueTokens({
      clientId,
      database: tx,
      subject: token.subject,
      scope: token.scope,
      resource: token.resource,
    });

    await tx
      .update(mcpOAuthTokensTable)
      .set({ replacedByTokenId: issued.rowId })
      .where(eq(mcpOAuthTokensTable.id, token.id));

    const { rowId: _rowId, ...response } = issued;
    return response;
  });
};

export const verifyAccessToken = async (accessToken: string, resource: string) => {
  const [token] = await db
    .select()
    .from(mcpOAuthTokensTable)
    .where(and(eq(mcpOAuthTokensTable.accessTokenHash, hashToken(accessToken)), isNull(mcpOAuthTokensTable.revokedAt)));

  if (!token || token.accessTokenExpiresAt <= new Date() || token.resource !== resource) {
    return null;
  }

  if (!token.scope.split(/\s+/).includes(MCP_READ_SCOPE)) {
    return null;
  }

  await db.update(mcpOAuthTokensTable).set({ lastUsedAt: new Date() }).where(eq(mcpOAuthTokensTable.id, token.id));

  return {
    token: accessToken,
    clientId: token.clientId,
    scopes: token.scope.split(/\s+/),
    expiresAt: Math.floor(token.accessTokenExpiresAt.getTime() / 1000),
    resource: new URL(resource),
    extra: { subject: token.subject },
  };
};

export const revokeToken = async (formData: FormData) => {
  const token = requireString(formData, "token");
  const tokenHash = hashToken(token);
  const revokedAt = new Date();

  await db.update(mcpOAuthTokensTable).set({ revokedAt }).where(eq(mcpOAuthTokensTable.accessTokenHash, tokenHash));
  await db.update(mcpOAuthTokensTable).set({ revokedAt }).where(eq(mcpOAuthTokensTable.refreshTokenHash, tokenHash));
};

export const toOAuthErrorResponse = (error: unknown) => {
  if (error instanceof OAuthError) {
    return Response.json({ error: error.code, error_description: error.message }, { status: error.status });
  }

  console.error("MCP OAuth error:", error);
  return Response.json({ error: "server_error", error_description: "Unexpected OAuth error" }, { status: 500 });
};
