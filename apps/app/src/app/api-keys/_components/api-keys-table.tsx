"use client"

import { MCP_WRITE_SCOPE } from "@better-bull-board/mcp/scopes"
import { Badge } from "@better-bull-board/ui/components/badge"
import { ScrollArea, ScrollBar } from "@better-bull-board/ui/components/scroll-area"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@better-bull-board/ui/components/table"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNowStrict } from "date-fns"

import { listApiKeysApiRoute } from "~/app/api/api-keys/schemas"
import { apiFetch } from "~/lib/utils/client"
import { formatUtcDateTime } from "~/lib/utils/date"

import { CreateApiKeyDialog } from "./create-api-key-dialog"
import { RevokeApiKeyButton } from "./revoke-api-key-button"

function RelativeTime({ value }: { value: Date | null }) {
  if (!value) return <span className="text-muted-foreground">Never</span>

  return (
    <time dateTime={value.toISOString()} title={formatUtcDateTime(value)}>
      {formatDistanceToNowStrict(value, { addSuffix: true })}
    </time>
  )
}

export function ApiKeysTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: apiFetch({ apiRoute: listApiKeysApiRoute, body: undefined }),
  })

  const apiKeys = data?.apiKeys ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Long-lived keys for server-side agents calling the MCP endpoint.
        </p>
        <div className="ml-auto">
          <CreateApiKeyDialog />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <ScrollArea>
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-55">Name</TableHead>
                <TableHead className="w-40">Key</TableHead>
                <TableHead className="w-30">Scope</TableHead>
                <TableHead className="w-35">Created</TableHead>
                <TableHead className="w-35">Last used</TableHead>
                <TableHead className="w-25">Status</TableHead>
                <TableHead className="w-16">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell>
                    <span className="block truncate font-medium" title={apiKey.name}>
                      {apiKey.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{apiKey.keyPrefix}…</span>
                  </TableCell>
                  <TableCell>
                    {apiKey.scope.split(/\s+/).includes(MCP_WRITE_SCOPE) ? "Read + write" : "Read"}
                  </TableCell>
                  <TableCell>
                    <RelativeTime value={apiKey.createdAt} />
                  </TableCell>
                  <TableCell>
                    <RelativeTime value={apiKey.lastUsedAt} />
                  </TableCell>
                  <TableCell>
                    {apiKey.revokedAt ? (
                      <Badge variant="outline" title={formatUtcDateTime(apiKey.revokedAt)}>
                        Revoked
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!apiKey.revokedAt && <RevokeApiKeyButton id={apiKey.id} name={apiKey.name} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && apiKeys.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No API keys yet. Create one to let a server-side agent call the MCP endpoint.
            </p>
          )}
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  )
}
