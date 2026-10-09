"use client"

import { Badge } from "@better-bull-board/ui/components/badge"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@better-bull-board/ui/components/hover-card"

type RunTagsProps = {
  tags: string[]
  /** Adds the tag to the runs filters */
  onTagClick: (tag: string) => void
}

/**
 * Tags of a run in a fixed-width cell: the first one, then a count of the others, with all of them in a hover card.
 * Every tag stays reachable even when they don't fit.
 */
export function RunTags({ tags, onTagClick }: RunTagsProps) {
  const [firstTag, ...otherTags] = tags
  if (!firstTag) return null

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={300}
        closeDelay={150}
        render={
          <div
            className="flex min-w-0 items-center gap-1"
            title={tags.length === 1 ? firstTag : undefined}
          />
        }
      >
        <Badge variant="outline" className="min-w-0 shrink">
          <span className="truncate">{firstTag}</span>
        </Badge>
        {otherTags.length > 0 && <Badge variant="secondary">+{otherTags.length}</Badge>}
      </HoverCardTrigger>
      {/* Portaled, but React events still bubble to the row: a click in the card must not open the run */}
      <HoverCardContent
        align="start"
        className="w-auto max-w-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs text-muted-foreground">
          {tags.length === 1 ? "1 tag" : `${tags.length} tags`} · click one to filter
        </p>
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="max-w-full cursor-pointer hover:bg-muted"
              render={
                <button
                  type="button"
                  aria-label={`Filter by tag ${tag}`}
                  onClick={() => onTagClick(tag)}
                />
              }
            >
              <span className="truncate">{tag}</span>
            </Badge>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
