import { Button, Card, CardBody, CardHeader, Image, Input, Switch, Textarea } from "@heroui/react";
import { BotIcon, Code2, Eye, FileUp, HandIcon, ImagePlusIcon, TrashIcon, XIcon } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import TurndownService from "turndown";
import InfoModal from "~components/Sync/Modals/InfoModal";
import type { FileData, SyncData } from "~sync/common";
import { renderMarkdownSafely, sanitizeHtml } from "~utils/sanitize";

const ArticleTab: React.FC = () => {
  const [title, setTitle] = useState<string>("");
  const [digest, setDigest] = useState<string>("");
  // markdown 编辑模式（导入 md 后开启）
  const [mdMode, setMdMode] = useState(false);
  const [mdViewMode, setMdViewMode] = useState<"edit" | "preview">("preview");
  const [mdSource, setMdSource] = useState<string>("");
  const [coverImage, setCoverImage] = useState<FileData | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const [autoPublish, setAutoPublish] = useState(true);
  // 提示弹窗（替代 alert）
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setTitle(chrome.i18n.getMessage("devEnvironmentTitle") || "开发环境标题");
      setDigest(chrome.i18n.getMessage("devEnvironmentContent") || "开发环境内容");
    }
  }, []);

  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile?.type.startsWith("image/")) {
      const newCover: FileData = {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
        url: URL.createObjectURL(selectedFile),
      };
      setCoverImage(newCover);
    }
  };

  const handleDeleteCover = () => {
    setCoverImage(null);
  };

  // 一键清空文章内容
  const handleClearAll = () => {
    setTitle("");
    setDigest("");
    setMdMode(false);
    setMdViewMode("preview");
    setMdSource("");
    setCoverImage(null);
  };

  // 点击发布：校验标题后，把待发布内容交给侧边栏选择平台并发布（不再弹窗）
  const handlePublishClick = async () => {
    if (!title) {
      setInfoMsg(chrome.i18n.getMessage("errorEnterTitle") || "请输入标题");
      return;
    }

    // 内容：md 模式下使用 markdown 源码，HTML 由 marked 渲染后再消毒；
    // 否则使用导入内容的 HTML，同样需要消毒（导入来源是任意站点，且该 HTML 会被注入平台编辑器页面）。
    const htmlContent = mdMode ? renderMarkdownSafely(mdSource) : sanitizeHtml(digest || "");
    const markdownContent = mdMode ? mdSource : turndownService.turndown(htmlContent);

    const data: SyncData = {
      platforms: [],
      data: {
        title,
        digest: digest || "",
        cover: coverImage || null,
        images: [],
        markdownContent,
        htmlContent,
      },
      isAutoPublish: autoPublish,
    };

    try {
      await chrome.storage.local.set({ pendingPublishData: { type: "ARTICLE", data } });
      const window = await chrome.windows.getCurrent({ populate: true });
      await chrome.sidePanel.open({ windowId: window.id });
    } catch (error) {
      console.error("打开侧边栏发布时出错:", error);
    }
  };

  // 导入本地 Markdown 文件，进入 markdown 编辑/预览模式
  const handleImportMarkdown = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const headingMatch = text.match(/^#\s+(.+)$/m);
      const mdTitle = headingMatch?.[1]?.trim() || file.name.replace(/\.md$/i, "") || "";

      // 从第一个普通段落提取摘要
      const paragraph = text
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .find(
          (block) =>
            block.length > 0 &&
            !block.startsWith("#") &&
            !/^```/.test(block) &&
            !/^[-*+]\s/.test(block) &&
            !/^\d+\.\s/.test(block),
        );
      const mdDigest = paragraph ? paragraph.replace(/[#*_`>\[\]()!-]/g, "").slice(0, 120) : "";

      setMdMode(true);
      setMdViewMode("preview");
      setMdSource(text);
      setTitle((prev) => prev || mdTitle);
      setDigest((prev) => prev || mdDigest);
    } catch (error) {
      console.error("导入 Markdown 失败:", error);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 w-full">
          <Card id="article-import-section" className="mb-4 shadow-none h-fit bg-default-50">
            <CardBody>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => mdInputRef.current?.click()}
                      startContent={<FileUp className="size-4" />}>
                      {chrome.i18n.getMessage("optionsImportMarkdown")}
                    </Button>
                    <input
                      type="file"
                      ref={mdInputRef}
                      accept=".md,.markdown,text/markdown,text/plain"
                      onChange={handleImportMarkdown}
                      className="hidden"
                    />
                  </div>
                  {(title || digest || mdSource || coverImage) && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={handleClearAll}
                      title={chrome.i18n.getMessage("optionsClearAll")}>
                      <TrashIcon className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="mb-4 shadow-none h-fit bg-default-50">
            <CardHeader>
              <h3 className="text-sm font-medium">{chrome.i18n.getMessage("optionsCoverImage")}</h3>
            </CardHeader>
            <CardBody>
              <div className="flex justify-center items-center">
                <input
                  type="file"
                  ref={coverInputRef}
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="hidden"
                />
                {coverImage ? (
                  <div className="relative group">
                    <Image
                      src={coverImage.url}
                      alt={coverImage.name}
                      width={200}
                      height={150}
                      className="object-cover rounded-md"
                    />
                    <Button
                      isIconOnly
                      size="sm"
                      color="danger"
                      className="absolute top-0 right-0 z-50 m-1 opacity-0 transition-opacity group-hover:opacity-100"
                      onPress={handleDeleteCover}>
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="light" onPress={() => coverInputRef.current?.click()}>
                    <ImagePlusIcon className="mr-2 w-6 h-6" />
                    {chrome.i18n.getMessage("optionsUploadCover")}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          <Card className="shadow-none h-fit bg-default-50">
            <CardHeader>
              <Input
                placeholder={chrome.i18n.getMessage("optionsEnterArticleTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full"
              />
            </CardHeader>

            <CardBody>
              <Textarea
                placeholder={chrome.i18n.getMessage("optionsEnterArticleDigest")}
                value={digest}
                onChange={(e) => setDigest(e.target.value)}
                fullWidth
                minRows={5}
                autoFocus
              />
            </CardBody>
          </Card>

          <Card className="shadow-none bg-default-50">
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{chrome.i18n.getMessage("optionsEditorTitle")}</h3>
              {mdMode && (
                <Switch
                  size="sm"
                  isSelected={mdViewMode === "preview"}
                  onValueChange={(value) => setMdViewMode(value ? "preview" : "edit")}
                  startContent={<Code2 className="size-3.5" />}
                  endContent={<Eye className="size-3.5" />}>
                  {chrome.i18n.getMessage("optionsMdPreview")}
                </Switch>
              )}
            </CardHeader>
            <CardBody>
              {mdMode ? (
                mdViewMode === "edit" ? (
                  <Textarea
                    value={mdSource}
                    onChange={(e) => setMdSource(e.target.value)}
                    placeholder={chrome.i18n.getMessage("optionsEnterMarkdown")}
                    minRows={8}
                    className="w-full font-mono"
                  />
                ) : (
                  <div
                    className="md-preview max-h-[420px] overflow-y-auto rounded-xl bg-default-50 p-4"
                    dangerouslySetInnerHTML={{ __html: renderMarkdownSafely(mdSource || "") }}
                  />
                )
              ) : (
                <p className="text-sm text-default-400">{chrome.i18n.getMessage("optionsArticleContentEmpty")}</p>
              )}
            </CardBody>
          </Card>

          <div className="sticky bottom-0 z-50 flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/90">
            <Switch
              isSelected={autoPublish}
              onValueChange={(value) => setAutoPublish(value)}
              startContent={<BotIcon className="size-4" />}
              endContent={<HandIcon className="size-4" />}>
              {autoPublish
                ? chrome.i18n.getMessage("optionsAutoPublish")
                : chrome.i18n.getMessage("optionsManualPublish")}
            </Switch>
            <Button onPress={handlePublishClick} color="primary" isDisabled={!title} className="px-6 font-bold">
              {chrome.i18n.getMessage("optionsSyncArticle")}
            </Button>
          </div>
        </div>
      </div>

      <InfoModal isOpen={!!infoMsg} message={infoMsg || ""} onClose={() => setInfoMsg(null)} />
    </>
  );
};

export default ArticleTab;
