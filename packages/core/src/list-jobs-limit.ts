import { ConcurrencyLimitError } from "./errors"

const DEFAULT_LIST_JOBS_MAX_CONCURRENT = 5

const getListJobsMaxConcurrent = () => {
  const parsed = Number(process.env.LIST_JOBS_MAX_CONCURRENT)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIST_JOBS_MAX_CONCURRENT
}

let activeListJobs = 0

export const withListJobsConcurrencyLimit = async <T>(fn: () => Promise<T>): Promise<T> => {
  if (activeListJobs >= getListJobsMaxConcurrent()) {
    throw new ConcurrencyLimitError()
  }

  activeListJobs++
  try {
    return await fn()
  } finally {
    activeListJobs--
  }
}
