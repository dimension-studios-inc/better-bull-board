export const repeat = <T>(
  fn: (resolve: () => void, reject: () => void) => T,
) => {
  return {
    every: (ms: number) => {
      let interval: NodeJS.Timeout;
      let resolve: () => void;
      let reject: () => void;
      const promise = new Promise<void>((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
        interval = setInterval(() => {
          fn(resolve, reject);
        }, ms);
        fn(resolve, reject);
      });
      const cleanup = () => {
        clearInterval(interval);
        resolve();
      };
      return {
        cleanup,
        promise,
      };
    },
  };
};
