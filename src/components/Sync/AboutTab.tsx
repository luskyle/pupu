import { Button, Card, CardBody } from "@heroui/react";
import { Github } from "lucide-react";
import type React from "react";

const AboutTab: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-none bg-default-50">
        <CardBody className="gap-6">
          <div className="flex justify-center items-center">
            <img src="/assets/icon.png" alt="logo" className="w-24 h-24 rounded-xl shadow-lg" />
          </div>
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold">{chrome.i18n.getMessage("extensionDisplayName")}</h2>
            <p className="text-sm text-foreground/60">v{chrome.runtime.getManifest().version}</p>
          </div>
          <p className="text-base text-center text-foreground/80">{chrome.i18n.getMessage("aboutDescription")}</p>
        </CardBody>
      </Card>

      <Card className="shadow-none bg-default-50">
        <CardBody className="gap-4">
          <h3 className="text-lg font-semibold">{chrome.i18n.getMessage("aboutAuthorTitle")}</h3>
          <p className="text-sm text-foreground/70">{chrome.i18n.getMessage("aboutAuthorDesc")}</p>
          <Button
            as="a"
            href="https://github.com/luskyle"
            target="_blank"
            rel="noreferrer"
            variant="flat"
            className="justify-center w-full"
            startContent={<Github className="size-4" />}>
            {chrome.i18n.getMessage("aboutAuthorGithub")}
          </Button>
        </CardBody>
      </Card>

      <p className="text-xs text-center text-foreground/40">{chrome.i18n.getMessage("aboutIconCredit")}</p>
    </div>
  );
};

export default AboutTab;
