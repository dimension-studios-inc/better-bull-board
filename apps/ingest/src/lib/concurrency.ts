export const mapWithConcurrency = async <T>(items: T[], concurrency: number, run: (item: T) => Promise<void>) => {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      if (item) await run(item);
    }
  });

  await Promise.all(workers);
};
