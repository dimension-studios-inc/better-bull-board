"use client"

import { Alert, AlertDescription, AlertTitle } from "@better-bull-board/ui/components/alert"
import { Button } from "@better-bull-board/ui/components/button"
import { CircleCheck, CircleX } from "lucide-react"
import { useState } from "react"

type Decision = "approve" | "deny"

export function AuthorizeForm({
  authorizeUrl,
  clientName,
}: {
  authorizeUrl: string
  clientName: string
}) {
  const [decision, setDecision] = useState<Decision | null>(null)

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    const submitted = event.submitter?.getAttribute("value") === "approve" ? "approve" : "deny"
    // An app redirect (claude://) leaves the tab here. Deferred: changing the form during the
    // submit event would drop the clicked button from the request
    setTimeout(() => setDecision(submitted))
  }

  return (
    <>
      <form
        action="/api/mcp/oauth/authorize/approve"
        method="post"
        hidden={decision !== null}
        onSubmit={handleSubmit}
        className="mt-6 flex gap-3"
      >
        <input type="hidden" name="authorize_url" value={authorizeUrl} />
        <Button type="submit" name="decision" value="approve" className="flex-1">
          Authorize
        </Button>
        <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
          Deny
        </Button>
      </form>
      {decision && (
        <Alert className="mt-6">
          {decision === "approve" ? <CircleCheck /> : <CircleX />}
          <AlertTitle>{decision === "approve" ? "Access granted" : "Access denied"}</AlertTitle>
          <AlertDescription>
            {clientName} has been notified. If your browser asks to open the app, allow it, then
            close this tab.
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
