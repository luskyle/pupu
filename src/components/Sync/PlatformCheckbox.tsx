import { Checkbox, Image } from "@heroui/react";
import type { PlatformInfo, SyncData } from "~sync/common";
import ExtraInfoConfig from "./ExtraInfoConfig";

interface PlatformCheckboxProps {
  platformInfo: PlatformInfo;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (key: string, isSelected: boolean) => void;
  syncData?: SyncData;
}

export default function PlatformCheckbox({
  platformInfo,
  isSelected,
  isDisabled,
  onChange,
  syncData,
}: PlatformCheckboxProps) {
  return (
    <div className="flex items-center p-2 transition-colors rounded-lg hover:bg-default-100">
      <div className="flex items-center flex-1 gap-2">
        <Checkbox
          isSelected={isSelected}
          isDisabled={isDisabled}
          onChange={(e) => onChange(platformInfo.name, e.target.checked)}
          size="sm"
        />

        <div className="flex items-center gap-1.5">
          {platformInfo.faviconUrl && (
            <Image
              src={platformInfo.faviconUrl}
              alt={platformInfo.platformName}
              width={20}
              height={20}
              className="rounded-sm"
            />
          )}

          <div className="flex items-center gap-2">
            <span className="transition-colors text-foreground">
              <span className="text-sm font-medium truncate">{platformInfo.platformName}</span>
            </span>

            {platformInfo.accountInfo && (
              <div className="flex items-center gap-1">
                {platformInfo.accountInfo.avatarUrl && (
                  <Image
                    src={platformInfo.accountInfo.avatarUrl}
                    alt={`${platformInfo.platformName}用户头像`}
                    width={18}
                    height={18}
                    className="rounded-full"
                  />
                )}
                <span className="text-xs text-default-600 truncate max-w-[120px] flex items-center gap-1">
                  {platformInfo.accountInfo.username}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ExtraInfoConfig platformInfo={platformInfo} syncData={syncData} />
    </div>
  );
}
