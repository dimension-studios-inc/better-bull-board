export type TRunFilters = {
  queue: string;
  status: string;
  search: string;
  tags: string[];
  cursor: { created_at: number; job_id: string; id: string } | null;
  limit: number;
};
