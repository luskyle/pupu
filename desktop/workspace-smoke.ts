import { BrowserWindow } from "electron";
import type { WorkspaceHost } from "./workspace-host";

export async function verifyWorkspace(workspace: WorkspaceHost) {
  const ui = workspace.window.webContents;
  const errors: string[] = [];
  ui.on("console-message", (event) => {
    if (event.level === "error") errors.push(`${event.message} (${event.sourceId}:${event.lineNumber})`);
  });
  const evaluate = async (source: string) => {
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([
        ui.executeJavaScript(source),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`验证步骤超时：${source.slice(0, 180)}；${errors.join("; ")}`)),
            30_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer!);
    }
  };
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate("document.querySelectorAll('.desktop-editor [role=tab]').length >= 4")) break;
    if (attempt === 99) throw new Error(`桌面 React 界面未就绪：${errors.join("; ")}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const initial = await evaluate(`({
    tabs: [...document.querySelectorAll('.desktop-editor [role=tab]')].map(el => el.textContent),
    files: [...document.querySelectorAll('.desktop-editor input[type=file]')].map(el => el.accept),
    isolated: typeof require === 'undefined' && typeof window.pupuWorkspace === 'object'
  })`);
  await evaluate(
    "window.addEventListener('unhandledrejection',event=>console.error(event.reason?.stack || event.reason))",
  );
  if (
    !initial.isolated ||
    !initial.files.some((accept: string) => accept.includes(".md")) ||
    !initial.files.some((accept: string) => accept.includes(".pdf")) ||
    !initial.files.some((accept: string) => accept.includes(".pptx"))
  )
    throw new Error("编辑器或隔离配置缺失");
  await evaluate(`(async () => {
    const input = document.querySelector('input[accept*=".md"]');
    const files = new DataTransfer();
    files.items.add(new File(["# 桌面 Markdown 验证\\n\\n内容 **加粗**"], "test.md", {type:"text/markdown"}));
    input.files = files.files;
    input.dispatchEvent(new Event("change", {bubbles:true}));
    await new Promise(resolve => setTimeout(resolve, 300));
  })()`);
  const markdown = await evaluate("document.querySelector('.md-preview')?.textContent");
  if (!markdown?.includes("桌面 Markdown 验证") || !markdown.includes("加粗"))
    throw new Error("真实 Markdown 导入/预览失败");
  console.log("WORKSPACE_CHECK_MARKDOWN_OK");
  const pdf = await evaluate(`(async () => {
    const {jsPDF, convertPdfToImages} = await import('./workspace-test-tools.js');
    const document = new jsPDF(); document.text('pupu desktop PDF test',20,20);
    const result = await convertPdfToImages(document.output('arraybuffer'));
    const blob = await (await fetch(result.images[0].url)).blob();
    return {pages:result.pageCount, images:result.images.length, size:blob.size, type:blob.type};
  })()`);
  if (pdf.pages !== 1 || pdf.images !== 1 || pdf.size < 100 || pdf.type !== "image/png")
    throw new Error("真实 PDF worker 转图验证失败");
  console.log("WORKSPACE_CHECK_PDF_OK");
  const ppt = await evaluate(`(async () => {
    const {convertPptxToImages} = await import('./workspace-test-tools.js');
    const source=await fetch(chrome.runtime.getURL('workspace-test.pptx'));
    const result=await convertPptxToImages(await source.arrayBuffer());
    const blob=await (await fetch(result.images[0].url)).blob();
    return {slides:result.slideCount,images:result.images.length,size:blob.size,type:blob.type};
  })()`);
  if (ppt.slides !== 1 || ppt.images !== 1 || ppt.size < 100 || ppt.type !== "image/png")
    throw new Error("真实 PPT 转图验证失败");
  console.log("WORKSPACE_CHECK_PPT_OK");
  await evaluate("document.querySelector('[data-publish-type=dynamic] textarea').focus()");
  await ui.insertText("真实按钮发布验证");
  await evaluate(`(async () => {
    const root = document.querySelector('[data-publish-type=dynamic]');
    const fileInput = root.querySelector('input[type=file][accept="image/*"]');
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
    const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const files=new DataTransfer();files.items.add(new File([image],'ui.png',{type:'image/png'}));
    fileInput.files=files.files;fileInput.dispatchEvent(new Event('change',{bubbles:true}));
    root.querySelector('input[role=switch]').click();
    await new Promise(resolve=>setTimeout(resolve,300));
    const publish=[...root.querySelectorAll('button')].find(button=>button.textContent.trim()===chrome.i18n.getMessage('optionsSyncDynamic'));
    if(!publish)throw new Error('发布按钮未找到');
    publish.click();
    for(let i=0;i<30;i++){
      const {pendingPublishData}=await chrome.storage.local.get('pendingPublishData');
      if(pendingPublishData){
        if(pendingPublishData.data.isAutoPublish || pendingPublishData.data.data.content!=='真实按钮发布验证' ||
          pendingPublishData.data.data.images.length!==1)throw new Error('按钮传递的发布数据不正确');
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('点击发布按钮没有形成待确认任务');
  })()`);
  await evaluate(`(async () => {
    for(let i=0;i<50;i++){
      const row=[...document.querySelectorAll('.desktop-panel .flex.items-center.p-2')].find(el=>el.textContent.trim()==='微博');
      if(row){row.querySelector('input[type=checkbox]').click();break;}
      if(i===49)throw new Error('平台选择界面没有出现');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    await new Promise(resolve=>setTimeout(resolve,200));
    const confirm=[...document.querySelectorAll('.desktop-panel button')].find(button=>button.textContent.trim()===chrome.i18n.getMessage('optionsPublishConfirm'));
    if(!confirm || confirm.disabled)throw new Error('确认发布按钮不可用');
    confirm.click();
    for(let i=0;i<150;i++){
      const groups=await chrome.runtime.sendMessage({type:'PUPU_EXTENSION_TABS_MANAGER_REQUEST_TABS'});
      const task=groups[0];
      if(task?.tabs[0]?.result?.status==='filled'){
        await chrome.runtime.sendMessage({type:'PUPU_EXTENSION_TABS_MANAGER_REMOVE_TASK',data:{tabId:task.tabs[0].tab.id}});
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('真实界面确认后的填写没有完成');
  })()`);
  console.log("WORKSPACE_CHECK_UI_PUBLISH_OK");
  const reply = await evaluate(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width=32; canvas.height=32;
    canvas.getContext('2d').fillRect(0,0,32,32);
    const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const imageURL = URL.createObjectURL(image);
    const platforms = ['DYNAMIC_WEIBO', 'ARTICLE_XUEQIU'].map(name => ({name}));
    const response = await chrome.runtime.sendMessage({
      action:'PUPU_EXTENSION_PUBLISH_NOW',
      data: {
        platforms, isAutoPublish:false,
        data: {title:'桌面多平台验证',content:'不提交的测试内容',images:[{name:'test.png',type:'image/png',size:image.size,url:imageURL}],
          videos:[],htmlContent:'<p>不提交的测试内容</p>',markdownContent:'不提交的测试内容',cover:null},
        origin: {htmlContent:'<p>不提交的测试内容</p>'}
      }
    });
    return {response,imageSize:image.size};
  })()`);
  if (!reply.response?.ok) throw new Error(reply.response?.error || "多平台任务没有回执");
  let groups;
  for (let attempt = 0; attempt < 200; attempt++) {
    groups = await evaluate("chrome.runtime.sendMessage({type:'PUPU_EXTENSION_TABS_MANAGER_REQUEST_TABS'})");
    if (groups[0]?.tabs.every((item: { result?: { status: string } }) => item.result?.status === "filled")) break;
    if (attempt === 199) throw new Error(`多平台填写未完成：${JSON.stringify(groups)}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const tabs = [...workspace.tabs.values()];
  if (tabs.length !== 2 || BrowserWindow.getAllWindows().length !== 1 || tabs.some((tab) => tab.view.getVisible()))
    throw new Error("多平台创建了窗口或抢占了工作台");
  const weibo = await tabs[0].view.webContents.executeJavaScript(`({
    content: document.querySelector('textarea').value, state:window.fixtureState,
    isolated: typeof require === 'undefined' && typeof window.pupuWorkspace === 'undefined'
  })`);
  const article = await tabs[1].view.webContents.executeJavaScript(`({
    title:document.querySelector('textarea[placeholder="请输入标题"]').value,
    content:document.querySelector('.ProseMirror').textContent,
    state:window.fixtureState
  })`);
  if (
    !weibo.isolated ||
    weibo.content !== "桌面多平台验证\n不提交的测试内容" ||
    weibo.state.files[0]?.size !== reply.imageSize ||
    article.title !== "桌面多平台验证" ||
    article.content !== "不提交的测试内容" ||
    weibo.state.submissions ||
    article.state.submissions
  )
    throw new Error(`平台实际写入/素材/手动模式验证失败：${JSON.stringify({ weibo, article })}`);
  await evaluate(`chrome.tabs.update(${tabs[0].id}, {active:true})`);
  if (!tabs[0].view.getVisible() || tabs[1].view.getVisible()) throw new Error("手动切换平台标签失败");
  await workspace.invoke("select", 0);
  const rednoteId = await evaluate(`(async () => {
    const {infoMap} = await import('./workspace-test-tools.js');
    const tab = await chrome.tabs.create({url:infoMap.DYNAMIC_REDNOTE.injectUrl});
    while ((await chrome.tabs.get(tab.id)).status !== 'complete') await new Promise(resolve=>setTimeout(resolve,100));
    const imageURL=URL.createObjectURL(new Blob(['rednote-image'],{type:'image/png'}));
    await chrome.tabs.sendMessage(tab.id,{
      type:'PUPU_REDNOTE_FILL',agentEnabled:false,
      data:{platforms:[{name:'DYNAMIC_REDNOTE'}],isAutoPublish:true,
        data:{title:'桌面图文验证',content:'小红书正文',images:[{name:'xhs.png',url:imageURL,type:'image/png'}],videos:[]}}
    });
    return tab.id;
  })()`);
  const rednoteState = await workspace.tabs
    .get(rednoteId)!
    .view.webContents.executeJavaScript(
      "({submissions:Number(document.body.dataset.submitCount),success:document.body.dataset.submitted})",
    );
  if (rednoteState.submissions !== 1 || rednoteState.success !== "true") throw new Error("小红书单次提交验证失败");
  const retry = await evaluate(
    `window.pupuWorkspace.invoke('update',{id:${rednoteId},properties:{url:'https://creator.xiaohongshu.com/publish/publish?target=image'}})`,
  );
  if (retry.ok) throw new Error("已提交页面允许重复执行");
  await workspace.invoke("select", 0);
  if (tabs[0].view.getVisible()) throw new Error("返回工作台失败");
  // 通过相同预加载/IPC/素材桥接验证视频传输，而非直接调用页面函数。
  const video = await evaluate(`(async () => {
    const tab = await chrome.tabs.create({url:'https://weibo.com'});
    while ((await chrome.tabs.get(tab.id)).status !== 'complete') await new Promise(resolve => setTimeout(resolve,100));
    const {infoMap} = await import('./workspace-test-tools.js');
    const url=URL.createObjectURL(new Blob(['video-fixture-bytes'],{type:'video/mp4'}));
    await chrome.scripting.executeScript({
      target:{tabId:tab.id},func:infoMap.VIDEO_WEIBO.injectFunction,
      args:[{platforms:[{name:'VIDEO_WEIBO'}],isAutoPublish:false,
        data:{title:'视频验证',content:'视频正文',video:{name:'test.mp4',url,type:'video/mp4'}}}]
    });
    return tab.id;
  })()`);
  const videoState = await workspace.tabs.get(video)!.view.webContents.executeJavaScript(`({
    title:document.querySelector('input[placeholder="填写标题（0～30个字）"]').value,
    state:window.fixtureState
  })`);
  if (
    videoState.title !== "视频验证" ||
    videoState.state.files[0]?.name !== "test.mp4" ||
    videoState.state.files[0]?.size !== 19 ||
    videoState.state.submissions
  )
    throw new Error("视频素材或手动模式验证失败");
  await workspace.invoke("select", 0);
  const unknown = await evaluate("window.pupuWorkspace.invoke('executeScript', 'arbitrary code')");
  if (unknown.ok) throw new Error("任意代码入口未被拒绝");
  const noWrite = await evaluate(`(async () => {
    const response=await chrome.runtime.sendMessage({
      action:'PUPU_EXTENSION_PUBLISH_NOW',
      data:{platforms:[{name:'DYNAMIC_ZHIHU'}],isAutoPublish:false,
        data:{title:'未填写的标题',content:'未填写的正文',images:[],videos:[]}}
    });
    if(!response.ok)throw new Error(response.error);
    for(let i=0;i<100;i++){
      const groups=await chrome.runtime.sendMessage({type:'PUPU_EXTENSION_TABS_MANAGER_REQUEST_TABS'});
      const task=groups[groups.length-1];
      if(task?.tabs[0]?.result?.status==='unconfirmed')return true;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return false;
  })()`);
  if (!noWrite) throw new Error("没有写入的适配器被误报为已填充");
  if (errors.length) throw new Error(`桌面渲染错误：${errors.join("; ")}`);
  console.log(
    "WORKSPACE_SMOKE_OK",
    JSON.stringify({
      editors: initial.tabs,
      uiPublishVerified: true,
      markdownImported: true,
      pdfConverted: true,
      pptConverted: true,
      imageUploaded: true,
      videoUploaded: true,
      rednoteSingleSubmit: true,
      duplicateRetryBlocked: true,
      noWriteUnconfirmed: true,
      platformCount: workspace.tabs.size,
      windowCount: BrowserWindow.getAllWindows().length,
      backgroundPreserved: true,
      platformBridgeAbsent: true,
      realPublished: false,
    }),
  );
}
