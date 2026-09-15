import { Button, Card, CardBody, CardFooter, Image, Progress, Switch, Tooltip } from "@heroui/react";
import {
  BotIcon,
  FileImageIcon,
  FileType2,
  HandIcon,
  HashIcon,
  Presentation,
  SendIcon,
  SmileIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Viewer from "react-viewer";
import { Player } from "video-react";
import "video-react/dist/video-react.css";
import InfoModal from "~components/Sync/Modals/InfoModal";
import type { FileData, SyncData } from "~sync/common";
import { convertPdfToImages } from "~utils/pdf";
import { convertPptxToImages } from "~utils/pptx";

// Constants
const MAX_VIDEO_COUNT = 1;

// 常用 emoji 表情（按分类扩充，去重）
interface EmojiCategory {
  key: string;
  label: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: "face",
    label: "笑脸",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😆",
      "😅",
      "🤣",
      "😂",
      "🙂",
      "😉",
      "😊",
      "😇",
      "🥰",
      "😍",
      "🤩",
      "😘",
      "😗",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤗",
      "🤭",
      "🤔",
      "🤐",
      "😏",
      "😒",
      "🙄",
      "😬",
      "😌",
      "😴",
      "🤤",
      "😷",
      "🤒",
      "🤢",
      "🤧",
      "🥵",
      "🥶",
      "🥴",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "🥸",
      "😎",
      "🤓",
      "🧐",
      "😕",
      "😟",
      "🙁",
      "😮",
      "😲",
      "😳",
      "🥺",
      "😨",
      "😰",
      "😥",
      "😢",
      "😭",
      "😱",
      "😖",
      "😣",
      "😞",
      "😓",
      "😩",
      "😫",
      "🥱",
      "😤",
      "😡",
      "😠",
      "🤬",
      "😈",
      "👿",
      "💀",
      "💩",
      "🤡",
      "👻",
      "👽",
      "🤖",
      "🎃",
      "😺",
      "😸",
      "😹",
      "😻",
      "😼",
      "🙀",
      "😿",
      "😾",
    ],
  },
  {
    key: "gesture",
    label: "手势",
    emojis: [
      "👋",
      "🤚",
      "✋",
      "🖖",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "👇",
      "☝️",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "👐",
      "🤲",
      "🤝",
      "🙏",
      "✍️",
      "💪",
      "👂",
      "👀",
      "👅",
      "👄",
    ],
  },
  {
    key: "love",
    label: "爱心",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"],
  },
  {
    key: "animal",
    label: "动物",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐸",
      "🐵",
      "🙈",
      "🙉",
      "🙊",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🦆",
      "🦅",
      "🦉",
      "🐴",
      "🦄",
      "🐝",
      "🦋",
      "🐌",
      "🐞",
      "🐢",
      "🐍",
      "🦖",
      "🦕",
      "🐙",
      "🦑",
      "🦐",
      "🦞",
      "🦀",
      "🐡",
      "🐠",
      "🐟",
      "🐬",
      "🐳",
      "🐋",
      "🦈",
      "🐊",
      "🦓",
      "🦍",
      "🐘",
      "🦒",
      "🦘",
      "🐫",
      "🐏",
      "🐑",
      "🦙",
      "🐐",
      "🦌",
      "🐕",
      "🐈",
      "🦃",
      "🦚",
      "🦜",
      "🕊️",
      "🐇",
      "🦝",
      "🦔",
    ],
  },
  {
    key: "food",
    label: "食物",
    emojis: [
      "🍏",
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶️",
      "🌽",
      "🥕",
      "🥔",
      "🍠",
      "🥐",
      "🥯",
      "🍞",
      "🥖",
      "🧀",
      "🥚",
      "🍳",
      "🧈",
      "🥞",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🌭",
      "🍔",
      "🍟",
      "🍕",
      "🥪",
      "🥙",
      "🌮",
      "🌯",
      "🥗",
      "🥘",
      "🍝",
      "🍜",
      "🍲",
      "🍛",
      "🍣",
      "🍱",
      "🥟",
      "🦪",
      "🍤",
      "🍙",
      "🍚",
      "🍥",
      "🥮",
      "🍢",
      "🍡",
      "🍧",
      "🍨",
      "🍦",
      "🥧",
      "🧁",
      "🍰",
      "🎂",
      "🍮",
      "🍭",
      "🍬",
      "🍫",
      "🍿",
      "🍩",
      "🍪",
      "🌰",
      "🥜",
      "🍯",
      "🥛",
      "☕",
      "🍵",
      "🧃",
      "🥤",
      "🧋",
      "🍶",
      "🍺",
      "🍻",
      "🥂",
      "🍷",
      "🥃",
      "🍸",
      "🍹",
      "🍾",
    ],
  },
  {
    key: "activity",
    label: "活动",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🎾",
      "🏐",
      "🏉",
      "🥏",
      "🎱",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "⛳",
      "🏹",
      "🎣",
      "🤿",
      "🥊",
      "🥋",
      "🎽",
      "🛹",
      "🛼",
      "⛸️",
      "🎿",
      "🏂",
      "🤼",
      "🤸",
      "🤺",
      "🏇",
      "🧘",
      "🏄",
      "🏊",
      "🚣",
      "🧗",
      "🚵",
      "🚴",
      "🏆",
      "🥇",
      "🥈",
      "🥉",
      "🏅",
      "🎖️",
      "🎫",
      "🎪",
      "🎭",
      "🎨",
      "🎬",
      "🎤",
      "🎧",
      "🎹",
      "🥁",
      "🎷",
      "🎺",
      "🎸",
      "🎻",
      "🎲",
      "🎯",
      "🎳",
      "🎮",
      "🎰",
      "🧩",
    ],
  },
  {
    key: "travel",
    label: "旅行",
    emojis: [
      "🚗",
      "🚕",
      "🚙",
      "🚌",
      "🚎",
      "🏎️",
      "🚓",
      "🚑",
      "🚒",
      "🚚",
      "🚜",
      "🛴",
      "🚲",
      "🛵",
      "🏍️",
      "🚨",
      "🚔",
      "🚍",
      "🚘",
      "🚖",
      "🚆",
      "🚇",
      "🚊",
      "🚉",
      "✈️",
      "🛫",
      "🛬",
      "🛩️",
      "💺",
      "🛰️",
      "🚀",
      "🛸",
      "🚁",
      "🛶",
      "⛵",
      "🚤",
      "🛥️",
      "🛳️",
      "⛴️",
      "🚢",
      "⚓",
      "⛽",
      "🚧",
      "🚦",
      "🚏",
      "🗺️",
      "🗿",
      "🗽",
      "🗼",
      "🏰",
      "🏯",
      "🏟️",
      "🎡",
      "🎢",
      "🎠",
      "⛲",
      "🏖️",
      "🏝️",
      "🏜️",
      "🌋",
      "⛰️",
      "🏔️",
      "🗻",
      "🏕️",
      "⛺",
      "🏠",
      "🏡",
      "🏭",
      "🏢",
      "🏬",
      "🏣",
      "🏥",
      "🏦",
      "🏨",
      "🏪",
      "🏫",
      "💒",
      "🏛️",
      "⛪",
      "🕌",
      "🕍",
      "🌅",
      "🌄",
      "🌠",
      "🎇",
      "🎆",
      "🌇",
      "🌆",
      "🏙️",
      "🌃",
      "🌌",
      "🌉",
    ],
  },
  {
    key: "symbol",
    label: "符号",
    emojis: [
      "💯",
      "🔔",
      "🎵",
      "🎶",
      "💤",
      "💥",
      "💫",
      "💦",
      "💨",
      "💬",
      "💭",
      "♨️",
      "🔥",
      "✨",
      "🎉",
      "🎊",
      "🎈",
      "🎁",
      "🎀",
      "🪄",
      "🪅",
      "🎏",
      "🎴",
      "🃏",
      "🆒",
      "🆕",
      "🆗",
      "🆙",
      "🆘",
      "🆑",
      "🆎",
      "🆚",
      "🈶",
      "🈯",
      "🉐",
      "🈹",
      "🈚",
      "🈲",
      "🉑",
      "🈸",
      "🈴",
      "🈳",
      "㊗️",
      "㊙️",
      "🈺",
      "🈵",
      "🔴",
      "🟠",
      "🟡",
      "🟢",
      "🔵",
      "🟣",
      "⚫",
      "⚪",
      "🔺",
      "🔻",
      "🔘",
      "♻️",
      "✅",
      "❌",
      "❎",
      "🌐",
      "ℹ️",
      "📶",
      "0️⃣",
      "1️⃣",
      "2️⃣",
      "3️⃣",
      "4️⃣",
      "5️⃣",
      "6️⃣",
      "7️⃣",
      "8️⃣",
      "9️⃣",
      "🔟",
      "#️⃣",
      "▶️",
      "⏸️",
      "⏹️",
      "⏭️",
      "⏩",
      "⏪",
      "⏫",
      "⏬",
      "◀️",
      "🔼",
      "🔽",
      "➡️",
      "⬅️",
      "⬆️",
      "⬇️",
      "↗️",
      "↘️",
      "↔️",
      "↩️",
      "↪️",
      "🔀",
      "🔁",
      "🔂",
      "🔄",
      "🔃",
      "➕",
      "➖",
      "➗",
      "✖️",
      "♾️",
      "💲",
      "™️",
      "©️",
      "®️",
      "〰️",
      "➰",
      "➿",
      "🔚",
      "🔙",
      "🔛",
      "🔝",
      "🔜",
      "✔️",
      "☑️",
      "⬛",
      "⬜",
      "🟥",
      "🟧",
      "🟨",
      "🟩",
      "🟦",
      "🟪",
    ],
  },
  {
    key: "kaomoji",
    label: "颜文字",
    emojis: [
      "(◕‿◕)",
      "(≧▽≦)",
      "(￣▽￣)",
      "(｡•̀ᴗ-)✧",
      "( ͡° ͜ʖ ͡°)",
      "ಠ_ಠ",
      "(￣▽￣)~*",
      "╰(*°▽°*)╯",
      "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧",
      "ヽ(✿ﾟ▽ﾟ)ノ",
      "(＾▽＾)",
      "(´･ω･`)",
      "(￣ω￣)",
      "( ˘ ³˘)♥",
      "(ノω<。)ノ))☆",
      "(>_<)",
      "(T_T)",
      "(ToT)/~~~",
      "＼(^o^)／",
      "(＾◇＾)",
      "(¬_¬)",
      "(^_^)",
      "(+_+)",
      "(o_o)",
      "(*_*)",
      "(*^▽^*)",
      "(≧∇≦)ﾉ",
      "(=^･ω･^=)",
      "(=^･ｪ･^=)",
      "(^・ω・^)",
      "ฅ(๑*▽*๑)ฅ",
      "₍ᐢ.⌄.ᐢ₎",
      "ᕦ(ò_óˇ)ᕤ",
      "(σ≧▽≦)σ",
      "٩(◕‿◕｡)۶",
      "(๑•̀ㅂ•́)و✧",
      "ヾ(≧▽≦*)o",
      "┐(´д`)┌",
      "¯_(ツ)_/¯",
      "( ˘ω˘ )",
      "(´▽`ʃ♡ƪ)",
      "ヾ(•ω•`)o",
      "(・∀・)",
      "(*´∀`)♪",
      "ヾ(＾∇＾)",
      "(๑>ᴗ<๑)",
      "ヽ(●´∀`●)ﾉ",
      "٩(ˊᗜˋ*)و",
      "(*¯︶¯*)",
      "ミ(ノ﹏ )ノ",
      "(_ _)ゞ",
      "(。・ω・。)ノ♡",
      "(・_・)ノ",
      "(╯°□°）╯︵ ┻━┻",
      "┬─┬ ノ( ゜-゜ノ)",
    ],
  },
];

interface FormState {
  content: string;
  images: FileData[];
  videos: FileData[];
  selectedPlatforms: string[];
  autoPublish: boolean;
}

const DynamicTab: React.FC = () => {
  const [formState, setFormState] = useState<FormState>({
    content: process.env.NODE_ENV === "development" ? "开发环境内容" : "",
    images: [],
    videos: [],
    selectedPlatforms: [],
    autoPublish: true,
  });

  // 内容输入框 ref（原生 textarea，可操作光标）与高亮层 ref（滚动同步）
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
  // 当前 emoji 分类（默认笑脸）
  const [emojiCategory, setEmojiCategory] = useState("face");

  const [viewerState, setViewerState] = useState({
    visible: false,
    currentImage: 0,
  });
  // 提示弹窗（替代 alert）
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pptInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const [processProgress, setProcessProgress] = useState(0);
  const [isPptx, setIsPptx] = useState(false);
  const [isDocx, setIsDocx] = useState(false);
  const [isPdf, setIsPdf] = useState(false);

  // 文件处理函数（提前声明，供图片/表情包等使用）
  const handleFileProcess = useCallback(
    (file: File): FileData => ({
      name: file.name,
      type: file.type,
      size: file.size,
      url: URL.createObjectURL(file),
    }),
    [],
  );

  // 内容光标插入：在光标处插入文本，并可将光标定位到指定偏移处（相对于插入文本末尾）
  const insertAtCursor = useCallback((text: string, caretOffset = 0) => {
    const ta = contentTextareaRef.current;
    setFormState((prev) => {
      const start = ta?.selectionStart ?? prev.content.length;
      const end = ta?.selectionEnd ?? start;
      const next = prev.content.slice(0, start) + text + prev.content.slice(end);
      const caret = start + text.length + caretOffset;
      setTimeout(() => {
        const el = contentTextareaRef.current;
        if (el) {
          el.focus();
          const pos = Math.max(0, Math.min(caret, next.length));
          el.setSelectionRange(pos, pos);
        }
      }, 0);
      return { ...prev, content: next };
    });
  }, []);

  // 添加话题：选中文字时用 # 包裹所选文字（转化为话题）；无选区时插入 ## 并把光标放到中间直接输入
  const addHashTopic = useCallback(() => {
    const ta = contentTextareaRef.current;
    setFormState((prev) => {
      const start = ta?.selectionStart ?? prev.content.length;
      const end = ta?.selectionEnd ?? start;
      if (start !== end) {
        // 有选区：用 # 包裹所选文字
        const selected = prev.content.slice(start, end);
        const wrapped = `#${selected}#`;
        const next = prev.content.slice(0, start) + wrapped + prev.content.slice(end);
        const caret = start + wrapped.length;
        setTimeout(() => {
          const el = contentTextareaRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(caret, caret);
          }
        }, 0);
        return { ...prev, content: next };
      }
      // 无选区：插入 ## 光标放到中间，用户直接输入话题文字
      const next = `${prev.content.slice(0, start)}##${prev.content.slice(end)}`;
      const caret = start + 1;
      setTimeout(() => {
        const el = contentTextareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(caret, caret);
        }
      }, 0);
      return { ...prev, content: next };
    });
  }, []);

  // 预览高亮：把 #话题# 渲染为蓝色（在输入框内直接显示编辑效果）
  const highlightTopics = useCallback((text: string) => {
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.replace(/#([^#\n]+)#/g, '<span class="text-sky-500 font-medium">#$1#</span>');
  }, []);

  // 输入框滚动时同步高亮层
  const syncHighlightScroll = useCallback(() => {
    const ta = contentTextareaRef.current;
    const layer = highlightLayerRef.current;
    if (ta && layer) layer.scrollTop = ta.scrollTop;
  }, []);

  // 粘贴处理
  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      // 仅处理动态 tab 区域内的粘贴，避免影响其它 tab（各 tab 保持挂载）
      if (dropAreaRef.current && !dropAreaRef.current.contains(event.target as Node)) {
        return;
      }

      const items = event.clipboardData?.items;
      if (!items) return;

      Array.from(items).forEach((item) => {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (!file) return;

          const fileData = handleFileProcess(file);

          if (file.type.startsWith("image/")) {
            setFormState((prev) => ({
              ...prev,
              images: [...prev.images, fileData],
            }));
          }
          // 视频添加已暂时屏蔽
        }
      });
    },
    [handleFileProcess, formState.videos.length],
  );

  // 拖放处理
  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const files = event.dataTransfer?.files;
      if (!files) return;

      const imageFiles: FileData[] = [];

      Array.from(files).forEach((file) => {
        const fileData = handleFileProcess(file);

        if (file.type.startsWith("image/")) {
          imageFiles.push(fileData);
        }
        // 视频添加已暂时屏蔽
      });

      setFormState((prev) => ({
        ...prev,
        images: [...prev.images, ...imageFiles],
      }));
    },
    [handleFileProcess, formState.videos.length],
  );

  // 添加事件监听器
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    const dropArea = dropAreaRef.current;

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    if (dropArea) {
      dropArea.addEventListener("dragover", handleDragOver);
      dropArea.addEventListener("drop", handleDrop);
    }

    return () => {
      document.removeEventListener("paste", handlePaste);
      if (dropArea) {
        dropArea.removeEventListener("dragover", handleDragOver);
        dropArea.removeEventListener("drop", handleDrop);
      }
    };
  }, [handlePaste, handleDrop]);

  // 文件变更处理
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, fileType: "image" | "video") => {
      const selectedFiles = event.target.files;
      if (!selectedFiles) return;

      const newFiles = Array.from(selectedFiles)
        .filter((file) => file.type.startsWith(`${fileType}/`))
        .map(handleFileProcess);

      setFormState((prev) => ({
        ...prev,
        [fileType === "image" ? "images" : "videos"]:
          fileType === "image"
            ? [...prev.images, ...newFiles]
            : newFiles.length > 0 && prev.videos.length < MAX_VIDEO_COUNT
              ? [newFiles[0]]
              : prev.videos,
      }));
    },
    [handleFileProcess],
  );

  // 导入本地 PPT（pptx），逐页转为图片
  const handleImportPptx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!/\.pptx$/i.test(file.name)) {
      setInfoMsg(chrome.i18n.getMessage("pptUnsupported") || "仅支持 .pptx 格式的 PPT 文件");
      return;
    }

    setIsProcessing(true);
    setProcessStatus(chrome.i18n.getMessage("pptProcessing") || "正在将 PPT 每一页转换为图片...");
    setProcessProgress(0);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { images, slideCount } = await convertPptxToImages(arrayBuffer, (current, total) => {
        setProcessStatus(
          chrome.i18n.getMessage("pptProgress", [String(current), String(total)]) ||
            `正在将 PPT 转换为图片（${current}/${total}）`,
        );
        setProcessProgress((current / total) * 100);
      });

      setFormState((prev) => ({
        ...prev,
        content: prev.content || file.name.replace(/\.pptx$/i, ""),
        images: [...prev.images, ...images],
      }));
      setIsPptx(true);
      setIsDocx(false);
      setIsPdf(false);
      setProcessStatus(
        chrome.i18n.getMessage("pptConvertDone", [String(slideCount)]) ||
          `已导入 PPT，共 ${slideCount} 页，已全部转为图片`,
      );
    } catch (error) {
      console.error("导入 PPT 失败:", error);
      setInfoMsg(chrome.i18n.getMessage("pptImportError") || "导入 PPT 失败，请确认文件为 .pptx 格式");
    } finally {
      setIsProcessing(false);
    }
  };

  // 导入本地 PDF 文档，逐页转为图片
  const handleImportPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!/\.pdf$/i.test(file.name)) {
      setInfoMsg(chrome.i18n.getMessage("pdfUnsupported") || "仅支持 .pdf 格式的文件");
      return;
    }

    setIsProcessing(true);
    setProcessStatus(chrome.i18n.getMessage("pdfProcessing") || "正在将 PDF 每一页转换为图片...");
    setProcessProgress(0);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { images, pageCount } = await convertPdfToImages(arrayBuffer, (current, total) => {
        setProcessStatus(
          chrome.i18n.getMessage("pdfProgress", [String(current), String(total)]) ||
            `正在将 PDF 转换为图片（${current}/${total}）`,
        );
        setProcessProgress((current / total) * 100);
      });

      setFormState((prev) => ({
        ...prev,
        content: prev.content || file.name.replace(/\.pdf$/i, ""),
        images: [...prev.images, ...images],
      }));
      setIsPdf(true);
      setIsPptx(false);
      setIsDocx(false);
      setProcessStatus(
        chrome.i18n.getMessage("pdfConvertDone", [String(pageCount)]) ||
          `已导入 PDF，共 ${pageCount} 页，已全部转为图片`,
      );
    } catch (error) {
      console.error("导入 PDF 失败:", error);
      setInfoMsg(chrome.i18n.getMessage("pdfImportError") || "导入 PDF 失败，请确认文件格式正确");
    } finally {
      setIsProcessing(false);
    }
  };

  // 点击发布：只要有标题/内容/图片/视频任一内容即可发布（不强制要求文字内容）
  const handlePublishClick = async () => {
    const isEmpty = !formState.content && formState.images.length === 0 && formState.videos.length === 0;
    if (isEmpty) {
      setInfoMsg(chrome.i18n.getMessage("optionsEnterDynamicContent"));
      return;
    }

    const data: SyncData = {
      platforms: [],
      data: {
        title: "",
        content: formState.content,
        images: formState.images,
        videos: formState.videos,
      },
      isAutoPublish: formState.autoPublish,
    };

    try {
      await chrome.storage.local.set({ pendingPublishData: { type: "DYNAMIC", data } });
      const window = await chrome.windows.getCurrent({ populate: true });
      await chrome.sidePanel.open({ windowId: window.id });
    } catch (error) {
      console.error("打开侧边栏发布时出错:", error);
    }
  };

  // 内容变化时，若存在待发布数据（侧边栏已打开等待确认），自动同步为最新内容，
  // 保证侧边栏确认发布的是修改后的内容而非点击时的旧快照（防抖 300ms）。
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const { pendingPublishData } = await chrome.storage.local.get("pendingPublishData");
        if (pendingPublishData?.type === "DYNAMIC") {
          const latest: SyncData = {
            platforms: [],
            data: {
              title: "",
              content: formState.content,
              images: formState.images,
              videos: formState.videos,
            },
            isAutoPublish: formState.autoPublish,
          };
          await chrome.storage.local.set({ pendingPublishData: { type: "DYNAMIC", data: latest } });
        }
      } catch {
        // 忽略写入异常
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [formState.content, formState.images, formState.videos, formState.autoPublish]);

  // 清空所有内容
  const handleClearAll = useCallback(() => {
    setFormState({
      content: "",
      images: [],
      videos: [],
      selectedPlatforms: [],
      autoPublish: true,
    });
    setIsPptx(false);
    setIsDocx(false);
    setIsPdf(false);
  }, []);

  // 删除文件
  const handleDeleteFile = useCallback((index: number, fileType: "image" | "video") => {
    setFormState((prev) => ({
      ...prev,
      [fileType === "image" ? "images" : "videos"]:
        fileType === "image" ? prev.images.filter((_, i) => i !== index) : [],
    }));
  }, []);

  // 图片查看器控制
  const handleImageClick = useCallback((index: number) => {
    setViewerState({
      currentImage: index,
      visible: true,
    });
  }, []);

  return (
    <div className="flex flex-col gap-4" ref={dropAreaRef}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col w-full gap-4">
          <Card className="shadow-none bg-default-50">
            <CardBody className="flex flex-col gap-2">
              {/* 内容输入框：原生 textarea + 高亮 overlay（#话题# 直接在输入框内显示蓝色，placeholder 有内容时自动消失） */}
              <div className="relative">
                <textarea
                  ref={contentTextareaRef}
                  value={formState.content}
                  onChange={(e) => setFormState((prev) => ({ ...prev, content: e.target.value }))}
                  onScroll={syncHighlightScroll}
                  placeholder={chrome.i18n.getMessage("optionsEnterDynamicContent")}
                  rows={6}
                  className="w-full resize-y rounded-xl border border-slate-200/70 bg-transparent p-3 text-transparent caret-slate-700 outline-none transition-colors focus:border-primary dark:border-slate-700/70 dark:caret-white"
                  style={{ fontFamily: "inherit", fontSize: "0.875rem", lineHeight: "1.625" }}
                />
                <div
                  ref={highlightLayerRef}
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-transparent p-3 text-sm text-foreground/90"
                  style={{ fontFamily: "inherit", fontSize: "0.875rem", lineHeight: "1.625" }}
                  dangerouslySetInnerHTML={{ __html: highlightTopics(formState.content) }}
                />
              </div>

              {/* 内容工具栏：话题 / emoji / 表情包（emoji 与表情包面板互斥） */}
              <div className="flex items-center gap-1 pt-1">
                <Tooltip content={chrome.i18n.getMessage("dynamicAddTopic")}>
                  <Button isIconOnly variant="light" size="sm" onPress={addHashTopic}>
                    <HashIcon className="size-4" />
                  </Button>
                </Tooltip>
                <Tooltip content={chrome.i18n.getMessage("dynamicInsertEmoji")}>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    color={emojiPanelOpen ? "primary" : "default"}
                    onPress={() => setEmojiPanelOpen((open) => !open)}>
                    <SmileIcon className="size-4" />
                  </Button>
                </Tooltip>
                <span className="ml-1 text-xs text-foreground/40">{chrome.i18n.getMessage("dynamicToolbarHint")}</span>
              </div>

              {/* emoji 表情面板：分类切换 + 颜文字 */}
              {emojiPanelOpen && (
                <div className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-default-100 p-2 dark:border-slate-700/70">
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {EMOJI_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors ${
                          emojiCategory === cat.key
                            ? "bg-primary text-white"
                            : "bg-default-200/60 text-foreground/70 hover:bg-default-200"
                        }`}
                        onClick={() => setEmojiCategory(cat.key)}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex max-h-44 flex-wrap gap-1 overflow-y-auto">
                    {(EMOJI_CATEGORIES.find((cat) => cat.key === emojiCategory) ?? EMOJI_CATEGORIES[0]).emojis.map(
                      (emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          title={emoji}
                          className={`rounded-md p-1 hover:bg-default-200 ${
                            emojiCategory === "kaomoji"
                              ? "w-28 shrink-0 truncate whitespace-nowrap text-center font-mono text-xs leading-8 text-foreground/90"
                              : "text-xl leading-none"
                          }`}
                          onClick={() => insertAtCursor(emoji)}>
                          {emoji}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}
            </CardBody>

            <CardFooter className="flex flex-col gap-2">
              <div className="flex items-center justify-between w-full">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "image")}
                    className="hidden"
                    multiple
                  />
                  <Button
                    variant="light"
                    size="sm"
                    startContent={<FileImageIcon className="size-4" />}
                    onPress={() => imageInputRef.current?.click()}>
                    {chrome.i18n.getMessage("optionsAddImage")}
                  </Button>
                  <input
                    type="file"
                    ref={pptInputRef}
                    accept=".pptx,.ppt"
                    onChange={handleImportPptx}
                    className="hidden"
                  />
                  <Button
                    variant="light"
                    size="sm"
                    startContent={<Presentation className="size-4" />}
                    onPress={() => pptInputRef.current?.click()}>
                    {chrome.i18n.getMessage("optionsAddPpt")}
                  </Button>
                  <input type="file" ref={pdfInputRef} accept=".pdf" onChange={handleImportPdf} className="hidden" />
                  <Button
                    variant="light"
                    size="sm"
                    startContent={<FileType2 className="size-4" />}
                    onPress={() => pdfInputRef.current?.click()}>
                    {chrome.i18n.getMessage("optionsAddPdf")}
                  </Button>
                  {formState.videos.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {chrome.i18n.getMessage("optionsNoticeDynamicVideo")}
                    </span>
                  )}
                </div>
                {(formState.content || formState.images.length > 0 || formState.videos.length > 0) && (
                  <Button
                    isIconOnly
                    variant="light"
                    color="danger"
                    onPress={handleClearAll}
                    title={chrome.i18n.getMessage("optionsClearAll")}>
                    <TrashIcon className="w-5 h-5" />
                  </Button>
                )}
              </div>

              {isProcessing && (
                <div className="flex flex-col gap-1 w-full">
                  <p className="text-sm">{processStatus}</p>
                  <Progress value={processProgress} color="primary" className="w-full" />
                </div>
              )}
            </CardFooter>
          </Card>

          {formState.images.length > 0 && (
            <Card className="shadow-none bg-default-50">
              {isPptx || isDocx || isPdf ? (
                <CardBody className="flex flex-col gap-4 p-4">
                  {formState.images.map((file, index) => (
                    <div key={index} className="relative group w-full">
                      <Image
                        src={file.url}
                        alt={file.name}
                        className="w-full h-auto object-contain rounded-lg cursor-pointer bg-default-100"
                        onClick={() => handleImageClick(index)}
                      />
                      <Button
                        isIconOnly
                        size="sm"
                        color="danger"
                        variant="light"
                        className="absolute z-50 transition-opacity duration-200 opacity-0 top-1 right-1 group-hover:opacity-100"
                        onPress={() => handleDeleteFile(index, "image")}>
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardBody>
              ) : (
                <CardBody className="flex flex-row flex-wrap items-start justify-start gap-3 p-4">
                  {formState.images.map((file, index) => (
                    <div key={index} className="relative group">
                      <Image
                        src={file.url}
                        alt={file.name}
                        width={120}
                        height={120}
                        className="object-cover rounded-lg cursor-pointer"
                        onClick={() => handleImageClick(index)}
                      />
                      <Button
                        isIconOnly
                        size="sm"
                        color="danger"
                        variant="light"
                        className="absolute z-50 transition-opacity duration-200 opacity-0 top-1 right-1 group-hover:opacity-100"
                        onPress={() => handleDeleteFile(index, "image")}>
                        <XIcon className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardBody>
              )}
            </Card>
          )}

          {formState.videos.length > 0 && (
            <Card className="shadow-none bg-default-50">
              <CardBody className="flex flex-col gap-4">
                {formState.videos.map((file, index) => (
                  <div key={index} className="relative w-full group aspect-video">
                    <Player playsInline src={file.url}>
                      <source src={file.url} />
                    </Player>
                    <Button
                      isIconOnly
                      size="sm"
                      color="danger"
                      variant="light"
                      className="absolute z-50 transition-opacity opacity-0 top-2 right-2 group-hover:opacity-100"
                      onPress={() => handleDeleteFile(index, "video")}>
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <div className="sticky bottom-0 z-50 flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/90">
            <Switch
              isSelected={formState.autoPublish}
              onValueChange={(value) => setFormState((prev) => ({ ...prev, autoPublish: value }))}
              startContent={<BotIcon className="size-4" />}
              endContent={<HandIcon className="size-4" />}>
              {formState.autoPublish
                ? chrome.i18n.getMessage("optionsAutoPublish")
                : chrome.i18n.getMessage("optionsManualPublish")}
            </Switch>
            <Button
              onPress={handlePublishClick}
              color="primary"
              isDisabled={!formState.content && formState.images.length === 0 && formState.videos.length === 0}>
              <SendIcon className="mr-2 size-4" />
              {chrome.i18n.getMessage("optionsSyncDynamic")}
            </Button>
          </div>
        </div>
      </div>

      <Viewer
        visible={viewerState.visible}
        onClose={() => setViewerState({ ...viewerState, visible: false })}
        images={formState.images.map((file) => ({ src: file.url, alt: file.name }))}
        activeIndex={viewerState.currentImage}
      />

      <InfoModal isOpen={!!infoMsg} message={infoMsg || ""} onClose={() => setInfoMsg(null)} />
    </div>
  );
};

export default DynamicTab;
