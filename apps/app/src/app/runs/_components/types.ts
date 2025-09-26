export type TRunFilters = {
  queue: string;
  status: string;
  search: string;
  cursor: string | null;
  direction?: 'next' | 'prev';
  limit: number;
};
