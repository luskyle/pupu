import "~style.css";
import cssText from "data-text:~style.css";
import { useEffect } from "react";

export function getShadowContainer() {
  return document.querySelector("#test-shadow")?.shadowRoot?.querySelector("#plasmo-shadow-container");
}

export const getShadowHostId = () => "test-shadow";

export const getStyle = () => {
  const style = document.createElement("style");

  style.textContent = cssText;
  return style;
};

const IndexPopup = () => {
  useEffect(() => {
    void chrome.runtime.openOptionsPage();
    window.close();
  }, []);

  return <div />;
};

export default IndexPopup;
