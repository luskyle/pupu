import type { PublishState } from "./page-tool";

export interface PublishSteps {
  signal: AbortSignal;
  progress: (message: string) => void;
  state: () => Promise<PublishState>;
  upload: () => Promise<void>;
  observeAndFill: () => Promise<void>;
  submit: () => Promise<void>;
  submitted: () => void;
  wait: () => Promise<void>;
}

// Polling never retries a submit: an uncertain result must be checked by the user.
export async function runPublisher(steps: PublishSteps) {
  const check = async () => {
    steps.signal.throwIfAborted();
    const state = await steps.state();
    if (state.blocked) throw new Error("需要登录或安全验证，请在平台窗口完成后重新开始");
    return state;
  };
  const initial = await check();
  if (initial.success) throw new Error("当前页面已有发布成功结果，请勿重复提交");
  steps.progress("1/4 正在上传图片并等待编辑器");
  await steps.upload();
  steps.signal.throwIfAborted();
  steps.progress("2/4 Agent 正在定位、填写并核验文字");
  await steps.observeAndFill();
  steps.progress("3/4 正在等待平台允许发布");
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    const state = await check();
    if (state.success) throw new Error("提交前页面已有发布结果，已停止，避免重复发布");
    if (state.submitReady) {
      ready = true;
      break;
    }
    await steps.wait();
  }
  if (!ready) throw new Error("发布按钮未就绪或无法识别；未提交，请检查图片、必填项或页面结构");
  steps.signal.throwIfAborted();
  // Mark before invoking the click, since an IPC failure can occur after the side effect.
  steps.submitted();
  await steps.submit();
  steps.progress("4/4 已发送提交，正在等待平台成功回执（不会自动重试）");
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = await check();
    if (state.success) return { submitted: true, verified: true };
    await steps.wait();
  }
  throw new Error("已经发送提交，但未确认平台发布成功。请到平台内容管理检查，不要直接重发");
}
