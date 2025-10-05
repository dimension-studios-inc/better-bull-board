export type TRunFilters = {
  queue: string;
  status: string;
  search: string;
  tags: string[];
  cursor: { createdAt: number; jobId: string; id: string } | null;
  limit: number;
};
