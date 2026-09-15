import { Button, Card, CardBody, CardFooter, CardHeader, Input, Switch, Textarea } from "@heroui/react";
import { BotIcon, FileVideo2Icon, HandIcon, SendIcon, TrashIcon, XIcon } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Player } from "video-react";
import { logger } from "~utils/logger";
import "video-react/dist/video-react.css";
import InfoModal from "~components/Sync/Modals/InfoModal";
import type { FileData, SyncData } from "~sync/common";

const VideoTab: React.FC = () => {
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [videoFile, setVideoFile] = useState<FileData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoPublish, setAutoPublish] = useState(true);
  // 提示弹窗（替代 alert）
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setTitle("开发环境标题");
      setContent("开发环境内容");
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile?.type.startsWith("video/")) {
      setVideoFile({
        name: selectedFile.name,
        url: URL.createObjectURL(selectedFile),
        type: selectedFile.type,
        size: selectedFile.size,
      });
    }
  };

  const handleRemoveVideo = () => {
    setVideoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 点击发布：校验内容后，把待发布内容交给侧边栏选择平台并发布（不再弹窗）
  const handlePublishClick = async () => {
    if (!title || !videoFile) {
      setInfoMsg(chrome.i18n.getMessage("optionsEnterVideoTitle"));
      return;
    }

    const data: SyncData = {
      platforms: [],
      data: {
        title,
        content,
        video: videoFile,
      },
      isAutoPublish: autoPublish,
    };

    try {
      await chrome.storage.local.set({ pendingPublishData: { type: "VIDEO", data } });
      const window = await chrome.windows.getCurrent({ populate: true });
      await chrome.sidePanel.open({ windowId: window.id });
    } catch (error) {
      logger.error("打开侧边栏发布时出错:", error);
    }
  };

  const handleIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearAll = () => {
    setTitle("");
    setContent("");
    setVideoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col w-full gap-4">
          <Card className="shadow-none bg-default-50">
            <CardHeader className="flex flex-col gap-4">
              <Input
                isClearable
                variant="underlined"
                label={chrome.i18n.getMessage("optionsEnterVideoTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onClear={() => setTitle("")}
                className="w-full"
              />
            </CardHeader>

            <CardBody>
              <Textarea
                isClearable
                label={chrome.i18n.getMessage("optionsEnterVideoDescription")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                variant="underlined"
                minRows={5}
                className="w-full"
                autoFocus
                onClear={() => setContent("")}
              />
            </CardBody>

            <CardFooter>
              <div className="flex items-center justify-between w-full">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    variant="light"
                    size="sm"
                    startContent={<FileVideo2Icon className="size-4" />}
                    onPress={handleIconClick}>
                    {chrome.i18n.getMessage("optionsAddVideo")}
                  </Button>
                </div>
                {(title || content || videoFile) && (
                  <Button
                    isIconOnly
                    variant="light"
                    color="danger"
                    onPress={handleClearAll}
                    title={chrome.i18n.getMessage("optionsClearAll")}>
                    <TrashIcon className="size-5" />
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>

          {videoFile && (
            <Card className="shadow-none bg-default-50">
              <CardBody className="p-4">
                <div className="relative w-full group aspect-video">
                  <Player playsInline src={videoFile.url}>
                    <source src={videoFile.url} />
                  </Player>
                  <Button
                    isIconOnly
                    size="sm"
                    color="danger"
                    variant="light"
                    className="absolute z-50 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100"
                    onPress={handleRemoveVideo}>
                    <XIcon className="size-4" />
                  </Button>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{videoFile.name}</p>
              </CardBody>
            </Card>
          )}

          <div className="sticky bottom-0 z-50 flex items-center justify-between gap-2 p-4 border shadow-sm rounded-xl border-slate-200/70 bg-white/90 backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/90">
            <Switch
              isSelected={autoPublish}
              onValueChange={(value) => setAutoPublish(value)}
              startContent={<BotIcon className="size-4" />}
              endContent={<HandIcon className="size-4" />}>
              {autoPublish
                ? chrome.i18n.getMessage("optionsAutoPublish")
                : chrome.i18n.getMessage("optionsManualPublish")}
            </Switch>
            <Button onPress={handlePublishClick} color="primary" isDisabled={!videoFile || !title}>
              <SendIcon className="mr-2 size-4" />
              {chrome.i18n.getMessage("optionsSyncVideo")}
            </Button>
          </div>
        </div>
      </div>

      <InfoModal isOpen={!!infoMsg} message={infoMsg || ""} onClose={() => setInfoMsg(null)} />
    </div>
  );
};

export default VideoTab;
