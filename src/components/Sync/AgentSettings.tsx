import { Button, Card, CardBody, Input, Switch } from "@heroui/react";
import { useEffect, useState } from "react";
import { AGENT_SETTINGS_KEY, DEFAULT_AGENT_MODEL, parseSettings } from "~agent/decision";

export default function AgentSettings() {
  const [enabled, setEnabled] = useState(false);
  const [model, setModel] = useState(DEFAULT_AGENT_MODEL);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    void chrome.storage.local
      .get(AGENT_SETTINGS_KEY)
      .then((stored) => {
        const settings = parseSettings(stored[AGENT_SETTINGS_KEY]);
        setEnabled(settings.enabled);
        setModel(settings.model);
        setReady(true);
      })
      .catch((error) => setMessage(`读取设置失败：${String(error)}；可重新保存默认设置`))
      .finally(() => setReady(true));
  }, []);
  const save = async (test: boolean) => {
    setBusy(true);
    setMessage("");
    try {
      const settings = parseSettings({ enabled, model });
      await chrome.storage.local.set({ [AGENT_SETTINGS_KEY]: settings });
      if (test) {
        const response = await chrome.runtime.sendMessage({ type: "PUPU_AGENT_TEST" });
        if (!response?.ok) throw new Error(response?.error || "后台没有返回连接结果");
      }
      setMessage(test ? "本地模型连接与有限选择测试通过" : "设置已保存，下次小红书任务生效");
    } catch (error) {
      setMessage(`操作失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="shadow-none bg-default-50">
      <CardBody className="gap-4">
        <h3 className="text-lg font-semibold">本地 Agent（实验）</h3>
        <p className="text-sm">
          小红书标题定位失败时，使用本机 Ollama 辅助定位。启用后小红书图文仅填充，不自动提交。
          只发送候选字段标签，不发送正文、图片或账号凭据。需自行安装 Ollama 并下载模型； 使用固定地址
          http://127.0.0.1:11434，不回退云端。
        </p>
        <Switch isSelected={enabled} onValueChange={setEnabled} isDisabled={!ready || busy}>
          启用本地智能辅助
        </Switch>
        <Input label="Ollama 模型名称" value={model} onValueChange={setModel} isDisabled={!ready || busy} />
        <div className="flex gap-2">
          <Button onPress={() => void save(false)} isDisabled={!ready || busy}>
            保存
          </Button>
          <Button onPress={() => void save(true)} isDisabled={!ready || busy}>
            保存并测试连接
          </Button>
        </div>
        <output className="text-sm">{message}</output>
      </CardBody>
    </Card>
  );
}
