import type { AdminRole } from "../content/types";

export type AdminTab =
  | "dashboard"
  | "work"
  | "content"
  | "links"
  | "media"
  | "team"
  | "orders"
  | "activity"
  | "settings";

export interface TabMeta {
  id: AdminTab;
  label: string;
  latin: string;
  hint: string;
  roles?: AdminRole[];
}

export const ADMIN_TABS: TabMeta[] = [
  { id: "dashboard", label: "داشبورد", latin: "OVERVIEW", hint: "نمای کلی سایت و میان‌برها" },
  { id: "work", label: "نمونه‌کارها", latin: "WORK", hint: "افزودن، ترتیب و انتشار پروژه‌ها" },
  { id: "content", label: "متن‌های سایت", latin: "COPY", hint: "هیرو، درباره، خدمات، تماس، پابرگ" },
  { id: "links", label: "لینک‌ها و کانال‌ها", latin: "LINKS", hint: "منو، شبکه‌ها، تماس و سئو" },
  { id: "media", label: "کتابخانهٔ تصاویر", latin: "MEDIA", hint: "بارگذاری و مدیریت رسانه‌ها" },
  { id: "team", label: "مدیران", latin: "TEAM", hint: "دسترسی‌ها و نقش‌ها" },
  { id: "orders", label: "سفارش‌ها", latin: "ORDERS", hint: "سفارش‌ها و پیامک‌ها" },
  { id: "activity", label: "فعالیت‌ها", latin: "LOG", hint: "تاریخچهٔ تغییرات" },
  { id: "settings", label: "تنظیمات", latin: "SYSTEM", hint: "پشتیبان‌گیری و بازنشانی" },
];

export const tabFromHash = (hash: string): AdminTab => {
  const value = hash.replace(/^#\/?/, "").replace(/^shenataisoni\/?/, "");
  const found = ADMIN_TABS.find((tab) => tab.id === value);
  return found ? found.id : "dashboard";
};
