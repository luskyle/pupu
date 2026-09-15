/**
 * 用户头像：12 生肖（按当前月份）+ 星座（按公历日期）。
 * 紫色渐变圆底（pupu 紫色系）+ 生肖 emoji，无外部资源。
 */
const ZODIAC = [
  { emoji: "🐭", label: "鼠" }, // 1月
  { emoji: "🐮", label: "牛" }, // 2月
  { emoji: "🐯", label: "虎" }, // 3月
  { emoji: "🐰", label: "兔" }, // 4月
  { emoji: "🐲", label: "龙" }, // 5月
  { emoji: "🐍", label: "蛇" }, // 6月
  { emoji: "🐴", label: "马" }, // 7月
  { emoji: "🐑", label: "羊" }, // 8月
  { emoji: "🐵", label: "猴" }, // 9月
  { emoji: "🐔", label: "鸡" }, // 10月
  { emoji: "🐶", label: "狗" }, // 11月
  { emoji: "🐷", label: "猪" }, // 12月
] as const;

// 星座名称（索引 0=摩羯…11=射手）与每月「分界日」（公历）；day < 分界日 → 上月星座，否则当月星座
const SIGN_NAMES = ["摩羯", "水瓶", "双鱼", "白羊", "金牛", "双子", "巨蟹", "狮子", "处女", "天秤", "天蝎", "射手"];
const SIGN_CUTOFF = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 23, 22]; // 1-12月

function getZodiacSign(date: Date): string {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const idx = day < SIGN_CUTOFF[month - 1] ? month - 1 : month;
  return SIGN_NAMES[idx % 12];
}

export default function AnonAvatar({ className = "h-8 w-8 rounded-full" }: { className?: string }) {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const animal = ZODIAC[month];
  const sign = getZodiacSign(now);
  return (
    <div
      className={`flex shrink-0 select-none items-center justify-center bg-gradient-to-br from-[#9266cc] to-[#553788] ${className}`}
      title={`${animal.label}（生肖）· ${sign}座`}
      aria-hidden="true">
      <span className="text-xl leading-none drop-shadow-sm">{animal.emoji}</span>
    </div>
  );
}
