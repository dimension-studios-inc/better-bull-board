/** Link to the queue page; queue names can hold characters that are not valid in a path segment */
export const getQueueHref = (queueName: string) => `/queues/${encodeURIComponent(queueName)}`
