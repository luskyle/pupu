import { type ChildProcess, spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface RuntimeConfig {
  executable: string;
  models: string;
}

export class LocalRuntime {
  private child?: ChildProcess;
  private starting?: Promise<void>;
  constructor(
    private configPath: string,
    private log: (message: string) => void,
  ) {}

  async configure(executable: string, models: string): Promise<void> {
    if (!path.isAbsolute(executable) || !path.isAbsolute(models)) throw new Error("运行时路径必须是绝对路径");
    await access(executable);
    await mkdir(models, { recursive: true });
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify({ executable, models }), { mode: 0o600 });
  }

  async ensure(): Promise<void> {
    if (!this.starting) {
      this.starting = this.start();
    }
    const pending = this.starting;
    try {
      await pending;
    } finally {
      if (this.starting === pending) this.starting = undefined;
    }
  }

  private async start(): Promise<void> {
    try {
      const response = await fetch("http://127.0.0.1:11434/api/version", {
        signal: AbortSignal.timeout(1500),
        redirect: "error",
      });
      if (response.ok) return;
    } catch (error) {
      this.log(`本地服务尚未就绪：${error instanceof Error ? error.message : String(error)}`);
    }
    if (this.child) throw new Error("本地服务正在启动或已异常退出，请检查运行日志");
    let value: unknown;
    try {
      value = JSON.parse(await readFile(this.configPath, "utf8"));
    } catch (error) {
      throw new Error(
        `未配置本地 Ollama，请先选择可执行文件：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (
      !value ||
      typeof value !== "object" ||
      !("executable" in value) ||
      typeof value.executable !== "string" ||
      !("models" in value) ||
      typeof value.models !== "string" ||
      !path.isAbsolute(value.executable) ||
      !path.isAbsolute(value.models)
    )
      throw new Error("本地运行时配置无效");
    const config: RuntimeConfig = { executable: value.executable, models: value.models };
    await access(config.executable);
    let failure = "";
    this.child = spawn(config.executable, ["serve"], {
      env: { ...process.env, OLLAMA_HOST: "127.0.0.1:11434", OLLAMA_MODELS: config.models, OLLAMA_NO_CLOUD: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child.on("error", (error) => {
      failure = error.message;
    });
    this.child.on("exit", (code) => {
      failure ||= `Ollama 已退出（${code}）`;
      this.child = undefined;
    });
    this.child.stderr?.on("data", (data) => this.log(String(data).trim()));
    for (let attempt = 0; attempt < 40; attempt++) {
      if (failure) throw new Error(failure);
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        const response = await fetch("http://127.0.0.1:11434/api/version", {
          signal: AbortSignal.timeout(1000),
          redirect: "error",
        });
        if (response.ok) return;
      } catch (error) {
        if (attempt === 39) throw new Error(`本地服务启动超时：${String(error)}`);
      }
    }
    throw new Error("本地服务启动超时");
  }

  stop(): void {
    this.child?.kill();
    this.child = undefined;
  }
}
