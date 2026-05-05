export type TRunFilters = {
  queue: string;
  status: string;
  search: string;
  tags: string[];
  createdFrom: string;
  createdTo: string;
  sortBy: "createdAt" | "durationMs";
  sortDirection: "asc" | "desc";
  cursor: { createdAt: number; jobId: string; id: string; durationMs?: number | null } | null;
  cursorDirection: "next" | "prev";
  limit: number;
};

export type TRunFilterUpdate = Partial<
  Pick<
    TRunFilters,
    | "queue"
    | "status"
    | "search"
    | "tags"
    | "createdFrom"
    | "createdTo"
    | "sortBy"
    | "sortDirection"
    | "cursor"
    | "cursorDirection"
  >
>;
