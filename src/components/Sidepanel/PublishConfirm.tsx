import { Accordion, AccordionItem, Button, Card, CardBody, CardFooter, CardHeader, Spinner } from "@heroui/react";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import PlatformCheckbox from "~components/Sync/PlatformCheckbox";
import { type PlatformInfo, type SyncData, getPlatformInfos, getTypePriorityPlatformKeys } from "~sync/common";
import { processContentForPublish } from "~sync/publish-process";
import { logger } from "~utils/logger";

export type PublishType = "DYNAMIC" | "VIDEO" | "ARTICLE";

/** 发布动作的最终结果：published 表示后台已创建平台标签页并开始填充 */
export interface PublishOutcome {
  status: "published" | "failed" | "cancelled";
  /** 失败原因（status 为 failed 时给出） */
  error?: string;
}

interface PublishConfirmProps {
  type: PublishType;
  data: SyncData;
  onDone: (outcome: PublishOutcome) => void;
}

/** 各发布类型对应的平台选择保存 key（与发布中心的旧逻辑保持一致） */
const PLATFORM_STORAGE_KEY: Record<PublishType, string> = {
  DYNAMIC: "dynamicPlatforms",
  VIDEO: "videoPlatforms",
  ARTICLE: "articlePlatforms",
};

/** 各发布类型对应的名称 i18n key（用于标题"发布 xxx 到平台"） */
const TYPE_NAME_KEY: Record<PublishType, string> = {
  DYNAMIC: "optionsDynamicTab",
  VIDEO: "optionsVideoTab",
  ARTICLE: "optionsPostTab",
};

/**
 * 侧边栏「发布确认」视图：选择 CN/国际平台后确认发布。
 * 替代原来发布中心的平台选择弹窗（PlatformSelectModal）。
 */
export default function PublishConfirm({ type, data, onDone }: PublishConfirmProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  // 发布失败原因：就地展示并允许重试，而不是关掉界面让用户以为发完了
  const [error, setError] = useState<string | null>(null);

  // 加载平台列表 + 上次保存的平台选择
  useEffect(() => {
    let alive = true;
    const init = async () => {
      try {
        const infos = await getPlatformInfos(type);
        if (alive) setPlatforms(infos);
      } catch (error) {
        logger.error("加载平台信息失败:", error);
      }
      try {
        const saved = JSON.parse(localStorage.getItem(PLATFORM_STORAGE_KEY[type]) || "[]");
        if (alive) setSelected(Array.isArray(saved) ? saved : []);
      } catch {
        // 忽略解析错误
      }
      if (alive) setLoading(false);
    };
    init();
    return () => {
      alive = false;
    };
  }, [type]);

  const handleChange = (platform: string, isSelected: boolean) => {
    setSelected((prev) => (isSelected ? [...prev, platform] : prev.filter((p) => p !== platform)));
  };

  const handleCancel = async () => {
    await chrome.storage.local.remove("pendingPublishData");
    onDone({ status: "cancelled" });
  };

  const handleConfirm = async () => {
    setPublishing(true);
    setError(null);
    try {
      localStorage.setItem(PLATFORM_STORAGE_KEY[type], JSON.stringify(selected));
      const platformList = selected.map((name) => {
        const info = platforms.find((p) => p.name === name);
        return {
          name,
          injectUrl: info?.injectUrl || "",
          extraConfig: info?.extraConfig || {},
        };
      });
      // 确认时重新读取最新待发布内容（内容可能在侧边栏打开后被修改），避免发布旧内容
      const { pendingPublishData } = await chrome.storage.local.get("pendingPublishData");
      const latest =
        pendingPublishData && pendingPublishData.type === type ? (pendingPublishData.data as SyncData) : data;
      // 内容处理（原发布进度弹窗做的事），随后直接让 background 创建平台标签发布，不再打开发布进度弹窗
      const publishData = await processContentForPublish({ ...latest, platforms: platformList });
      const response = (await chrome.runtime.sendMessage({
        action: "PUPU_EXTENSION_PUBLISH_NOW",
        data: publishData,
      })) as { ok?: boolean; error?: string } | undefined;

      // 必须按后台回执判定成败：以前无论成败都走 onDone(true)，界面照常消失，
      // 于是「一个平台都没发出去」被显示成发布完成。
      if (!response?.ok) {
        const message = response?.error || "扩展后台没有返回发布结果";
        logger.error("发布失败:", message);
        setError(message);
        onDone({ status: "failed", error: message });
        return;
      }

      await chrome.storage.local.remove("pendingPublishData");
      onDone({ status: "published" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      logger.error("发布失败:", caught);
      setError(message);
      onDone({ status: "failed", error: message });
    } finally {
      setPublishing(false);
    }
  };

  // 常用平台 + 其它平台分组（用户指定常用平台优先展示，其余平台统一归入「其它」）
  const priorityKeys = getTypePriorityPlatformKeys(type);
  const priorityPlatforms = platforms.filter((p) => priorityKeys.includes(p.accountKey));
  const otherPlatforms = platforms.filter((p) => !priorityKeys.includes(p.accountKey));

  // 标题：发布 xxx 到平台（如 发布动态到平台 / 发布视频到平台 / 发布文章到平台）
  const typeName = chrome.i18n.getMessage(TYPE_NAME_KEY[type]) || type.toLowerCase();
  const publishTitle = chrome.i18n.getMessage("sidepanelPublishToTitle", [typeName]) || `发布${typeName}到平台`;

  const renderGroup = (group: PlatformInfo[]) => (
    <div className="grid grid-cols-1 gap-2">
      {group.map((platform) => (
        <PlatformCheckbox
          key={platform.name}
          platformInfo={platform}
          isSelected={selected.includes(platform.name)}
          onChange={(_, isSelected) => handleChange(platform.name, isSelected)}
          isDisabled={publishing}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-none bg-default-50">
        <CardHeader className="pb-0">
          <h3 className="text-lg font-semibold">{publishTitle}</h3>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : (
            <Accordion isCompact variant="light" selectionMode="multiple" defaultExpandedKeys={["priority"]}>
              <AccordionItem
                key="priority"
                title={chrome.i18n.getMessage("optionsPriorityPlatforms")}
                subtitle={`${
                  selected.filter((name) => priorityPlatforms.some((p) => p.name === name)).length
                }/${priorityPlatforms.length}`}
                startContent={<div className="w-8 text-center text-xl leading-none">⭐</div>}
                className="py-1">
                {renderGroup(priorityPlatforms)}
              </AccordionItem>
              <AccordionItem
                key="other"
                title={chrome.i18n.getMessage("optionsOtherPlatforms")}
                subtitle={`${
                  selected.filter((name) => otherPlatforms.some((p) => p.name === name)).length
                }/${otherPlatforms.length}`}
                startContent={<div className="w-8 text-center text-xl leading-none">📦</div>}
                className="py-1">
                {renderGroup(otherPlatforms)}
              </AccordionItem>
            </Accordion>
          )}
          {error && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100 dark:bg-red-950/40 dark:border-red-900">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                <div className="space-y-1 min-w-0">
                  <div className="text-sm font-medium text-red-800 dark:text-red-200">
                    {chrome.i18n.getMessage("sidepanelPublishFailedTitle")}
                  </div>
                  <div className="text-xs break-all text-red-700 dark:text-red-300">{error}</div>
                  <div className="text-xs text-red-700 dark:text-red-300">
                    {chrome.i18n.getMessage("sidepanelPublishFailedHint")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardBody>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="light" isDisabled={publishing} onPress={handleCancel}>
            {chrome.i18n.getMessage("optionsCancel")}
          </Button>
          <Button
            color="primary"
            isDisabled={selected.length === 0 || publishing}
            isLoading={publishing}
            onPress={handleConfirm}>
            {chrome.i18n.getMessage("optionsPublishConfirm")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
