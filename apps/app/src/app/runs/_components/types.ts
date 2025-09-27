export type TRunFilters = {
  queue: string;
  status: string;
  search: string;
  tags: string[];
  cursor: number | null;
  limit: number;
};
