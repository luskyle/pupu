import { logger } from "~utils/logger";
import "~style.css";
import cssText from "data-text:~style.css";
import { Button, Checkbox, HeroUIProvider, Image } from "@heroui/react";
import { Storage } from "@plasmohq/storage";
import { CheckCircle2, Globe, Shield, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeProvider } from "~utils/theme";

export function getShadowContainer() {
  return document.querySelector("#test-shadow").shadowRoot.querySelector("#plasmo-shadow-container");
}

export const getShadowHostId = () => "test-shadow";

export const getStyle = () => {
  const style = document.createElement("style");

  style.textContent = cssText;
  return style;
};

interface TrustDomainParams {
  action: string;
  origin: string;
}

interface FeedbackState {
  type: "success" | "error";
  message: string;
}

const TrustDomain = () => {
  const [params, setParams] = useState<TrustDomainParams | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const storage = new Storage({ area: "local" });

  useEffect(() => {
    document.title = chrome.i18n.getMessage("optionsTitle");
    try {
      // 获取 hash 部分（移除开头的 #）
      const encodedParams = window.location.hash.substring(1);
      if (!encodedParams) {
        throw new Error("No parameters found");
      }

      // 解码 base64 并解析 JSON
      const decodedParams = JSON.parse(atob(encodedParams));
      setParams(decodedParams);
    } catch (error) {
      logger.error("Error parsing parameters:", error);
      setParams({
        action: "",
        origin: "",
      });
    }
  }, []);

  const handleTrustDomain = async (trust: boolean) => {
    if (!params?.origin) return;

    setIsProcessing(true);
    try {
      const trustedDomains = (await storage.get<Array<{ id: string; domain: string }>>("trustedDomains")) || [];

      if (trust) {
        // 检查域名是否已存在
        const domainExists = trustedDomains.some(({ domain }) => domain === params.origin);
        if (!domainExists) {
          trustedDomains.push({
            id: crypto.randomUUID(),
            domain: params.origin,
          });
          await storage.set("trustedDomains", trustedDomains);
        }
        setFeedback({
          type: "success",
          message: chrome.i18n.getMessage("settingsTrustedDomainsAdded") || "已添加到信任域名列表",
        });
      } else {
        setFeedback({
          type: "error",
          message: chrome.i18n.getMessage("settingsTrustedDomainsRejected") || "已拒绝此域名请求",
        });
      }
      chrome.runtime.sendMessage({
        type: "PUPU_EXTENSION_TRUST_DOMAIN_CONFIRM",
        origin: params.origin,
        trusted: trust,
        status: trust ? "confirm" : "cancel",
      });

      // 延迟关闭窗口
      setTimeout(() => {
        window.close();
      }, 3000);
    } catch (error) {
      logger.error("Error handling trust domain:", error);
      setFeedback({
        type: "error",
        message: chrome.i18n.getMessage("settingsTrustedDomainsError") || "处理请求时发生错误",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <HeroUIProvider>
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50/30 dark:bg-slate-950">
          <div className="p-6 mx-auto max-w-md">
            <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm dark:bg-slate-900 dark:border-slate-700">
              <div className="flex flex-col justify-center items-center mb-8">
                <Image
                  src={chrome.runtime.getURL("assets/icon.png")}
                  alt="logo"
                  className="mb-3 w-16 h-16 rounded-lg"
                />
                <div className="inline-flex items-center hover:text-blue-600 dark:hover:text-blue-400">
                  <h1 className="text-2xl font-semibold">{chrome.i18n.getMessage("optionsTitle")}</h1>
                </div>
              </div>

              <div className="flex gap-3 justify-center items-center mb-6 ju">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {chrome.i18n.getMessage("settingsTrustedDomains")}
                </h1>
              </div>

              {params && (
                <div className="space-y-6">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex gap-3 items-start">
                      <Globe className="w-5 h-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                      <div>
                        <div className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                          {chrome.i18n.getMessage("settingsTrustedDomainsOrigin")}
                        </div>
                        <div className="text-base font-medium text-gray-900 dark:text-gray-100">{params.origin}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 dark:bg-amber-950/40 dark:border-amber-900">
                    <div className="flex gap-3">
                      <Shield className="w-5 h-5 text-amber-500 mt-0.5" />
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 text-sm font-medium text-amber-800 dark:text-amber-200">
                            {chrome.i18n.getMessage("settingsTrustedDomainsSafetyTip")}
                          </div>
                          <div className="text-sm text-amber-700 dark:text-amber-300">
                            {chrome.i18n.getMessage("settingsTrustedDomainsConfirm")}
                          </div>
                        </div>
                        <ul className="ml-4 space-y-2 text-sm list-disc text-amber-700 dark:text-amber-300">
                          <li>{chrome.i18n.getMessage("settingsTrustedDomainsAllowPublish")}</li>
                          <li>{chrome.i18n.getMessage("settingsTrustedDomainsAllowAPI")}</li>
                          <li>
                            {chrome.i18n.getMessage("settingsTrustedDomainsCancel")}
                            &nbsp;
                            <a
                              href={chrome.runtime.getURL("options.html")}
                              target="_blank"
                              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                              rel="noreferrer">
                              {chrome.i18n.getMessage("gSettings")}
                            </a>
                          </li>
                        </ul>
                        <div className="flex gap-2 items-center pt-2 text-xs text-amber-600 dark:text-amber-400">
                          <Globe className="w-4 h-4" />
                          <span>
                            {chrome.i18n.getMessage("settingsTrustedDomainsOnlyAllow")} {params?.origin}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!feedback && (
                    <>
                      <div className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-100 dark:bg-slate-800 dark:border-slate-700">
                        <Checkbox
                          checked={isConfirmed}
                          onChange={(e) => setIsConfirmed(e.target.checked)}
                          className="mt-0.5"
                        />
                        <label className="text-sm text-gray-600 dark:text-gray-300">
                          {chrome.i18n.getMessage("settingsTrustedDomainsConfirmText")}
                        </label>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          variant="ghost"
                          className="flex-1 h-10"
                          onPress={() => handleTrustDomain(false)}
                          disabled={isProcessing}>
                          <XCircle className="mr-2 w-4 h-4" />
                          {chrome.i18n.getMessage("settingsTrustedDomainsReject")}
                        </Button>
                        <Button
                          isDisabled={isProcessing || !isConfirmed}
                          variant="solid"
                          className="flex-1 h-10"
                          onPress={() => handleTrustDomain(true)}>
                          <Shield className="mr-2 w-4 h-4" />
                          {chrome.i18n.getMessage("settingsTrustedDomainsAllow")}
                        </Button>
                      </div>
                    </>
                  )}

                  {feedback && (
                    <div
                      className={`flex items-center justify-center p-4 rounded-lg transition-all duration-300 ${
                        feedback.type === "success"
                          ? "bg-green-50 border-green-100 dark:bg-green-950/40 dark:border-green-900"
                          : "bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-900"
                      }`}>
                      <div className="flex gap-2 items-center">
                        {feedback.type === "success" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span
                          className={
                            feedback.type === "success"
                              ? "text-green-700 dark:text-green-300"
                              : "text-red-700 dark:text-red-300"
                          }>
                          {feedback.message}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </ThemeProvider>
    </HeroUIProvider>
  );
};

export default TrustDomain;
