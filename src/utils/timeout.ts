// 给「可能永远不结束」的异步操作加一个上限（纯函数，零依赖）。
//
// 由来：平台适配器的填充函数会等待页面元素出现，页面结构一变就可能一直等下去；
// 上游据此把超时标为「待确认」而不是「失败」—— 内容可能仍在填充，也可能已经卡住，
// 两者对用户的含义不同（前者等一下，后者去看一眼）。

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * 返回一个在 timeoutMs 内未结束时以 TimeoutError 拒绝的 Promise。
 * 已结束的 Promise 无论成功或失败都原样透传。
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(message ?? `操作超过 ${timeoutMs}ms 未完成`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
