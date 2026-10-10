const bridge = window.pupuDesktop;
const element = (id) => document.getElementById(id);
let busy = false;
let modelReady = false;
let imageCount = 0;
let target = "rednote";

async function call(action, data) {
  const result = await bridge.invoke(action, data);
  if (!result?.ok) throw new Error(result?.error || "桌面服务没有返回结果");
  return result.data;
}
function draft() {
  return { model: element("model").value, title: element("title").value, content: element("content").value };
}
function missingContent(destination = "rednote") {
  if (!element("title").value.trim()) return { message: "请先输入标题", field: "title" };
  if (!element("content").value.trim()) return { message: "请先输入正文", field: "content" };
  if (destination === "rednote" && imageCount === 0)
    return { message: "请先点击「添加图片」选择至少 1 张图片。重启应用后需要重新选择图片。", field: "assets" };
  return null;
}
function update() {
  element("titleCount").textContent = `${element("title").value.length} / 20`;
  for (const button of document.querySelectorAll("button")) button.disabled = busy;
  element("showPlatform").disabled = false;
  element("cancel").disabled = !busy;
  element("publish").textContent = busy ? "任务进行中…" : "让 Agent 自动发布";
  element("publishHelp").textContent = busy
    ? "正在执行任务，进度见下方；可点击停止任务。"
    : missingContent()?.message ||
      (modelReady ? "已准备好，点击后确认本次发布任务。" : "点击后会重新检查本地模型；连接失败会显示原因。");
  for (const field of document.querySelectorAll("input, textarea")) field.disabled = busy;
}
function message(text) {
  element("progress").textContent = text;
  const item = document.createElement("li");
  item.textContent = text;
  element("history").append(item);
  while (element("history").children.length > 12) element("history").firstElementChild.remove();
}
async function run(action) {
  if (busy) return;
  busy = true;
  update();
  try {
    await action();
  } catch (error) {
    message(`任务暂停：${error.message}`);
  } finally {
    busy = false;
    update();
  }
}
function showModels(result) {
  modelReady = result.models.some((model) => model.name === element("model").value);
  element("models").textContent = modelReady ? "本地 Agent 已就绪" : "模型尚未就绪，请打开高级设置下载";
  update();
}
async function refreshAssets() {
  const names = await call("assetState");
  imageCount = names.length;
  element("assetNames").textContent = names.length
    ? `${names.length} 张图片：${names.join("、")}`
    : "小红书图文至少需要 1 张图片";
}
bridge.onProgress(message);
for (const id of ["title", "content"]) element(id).oninput = update;
element("model").oninput = () => {
  modelReady = false;
  update();
};
element("status").onclick = () => run(async () => showModels(await call("status")));
element("configure").onclick = () => run(async () => showModels(await call("configure")));
element("download").onclick = () => run(async () => showModels(await call("download")));
element("saveDraft").onclick = () =>
  run(async () => {
    await call("saveDraft", draft());
    message("草稿已保存，重启后可恢复");
  });
element("assets").onclick = () =>
  run(async () => {
    const names = await call("assets");
    imageCount = names.length;
    element("assetNames").textContent = names.length ? `${names.length} 张图片：${names.join("、")}` : "请添加图片";
  });
element("rednote").onclick = () =>
  run(async () => {
    target = "rednote";
    await call("open", target);
    message("请在平台窗口登录并确认账号，返回这里点击自动发布。");
  });
async function publish(destination) {
  target = destination;
  element("history").replaceChildren();
  message("正在检查发布所需的内容、图片和本地模型…");
  await refreshAssets();
  const missing = missingContent(destination);
  if (missing) {
    throw new Error(missing.message);
  }
  showModels(await call("status"));
  if (!modelReady) {
    element("settings").open = true;
    throw new Error(`未找到本地模型 ${element("model").value}，请在高级设置中检查或下载模型`);
  }
  await call("saveDraft", draft());
  const result = await call("publish", { ...draft(), target });
  message(
    result.verified
      ? target === "fixture"
        ? "本地模拟发布成功，没有向互联网发布。"
        : "平台已显示发布成功。可在内容管理查看笔记。"
      : "提交结果未确认，请在平台检查，勿重复发布。",
  );
}
element("publish").onclick = () => run(() => publish("rednote"));
element("fixture").onclick = () =>
  run(async () => {
    await call("open", "fixture");
    await publish("fixture");
  });
element("showPlatform").onclick = async () => {
  try {
    await call("showPlatform");
  } catch (error) {
    message(error.message);
  }
};
element("cancel").onclick = async () => {
  try {
    await call("cancel");
    message("已请求停止；已提交的内容不能撤销，请核对平台结果。");
  } catch (error) {
    message(error.message);
  }
};
update();
void (async () => {
  try {
    const saved = await call("draft");
    for (const key of ["model", "title", "content"]) element(key).value = saved[key];
    update();
    await refreshAssets();
    showModels(await call("status"));
  } catch (error) {
    element("models").textContent = `Agent 未就绪：${error.message}`;
    message(`初始化未完成：${error.message}。可点击自动发布重新检查，或在高级设置中检查模型。`);
    update();
  }
})();
