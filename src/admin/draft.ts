import type { SiteContent, WorkItem } from "../content/types";

export const getPath = (source: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) return current[Number(key)];
    if (typeof current === "object") return (current as Record<string, unknown>)[key];
    return undefined;
  }, source);

/** Immutable setter used by every form field. */
export function setPath<T>(source: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const clone = (node: unknown, index: number): unknown => {
    const key = keys[index];
    if (index === keys.length - 1) {
      if (Array.isArray(node)) {
        const copy = node.slice();
        copy[Number(key)] = value;
        return copy;
      }
      return { ...(node as Record<string, unknown>), [key]: value };
    }
    const child = Array.isArray(node)
      ? node[Number(key)]
      : (node as Record<string, unknown> | undefined)?.[key];
    const next = clone(child ?? (Number.isFinite(Number(keys[index + 1])) ? [] : {}), index + 1);
    if (Array.isArray(node)) {
      const copy = node.slice();
      copy[Number(key)] = next;
      return copy;
    }
    return { ...(node as Record<string, unknown>), [key]: next };
  };
  return clone(source, 0) as T;
}

export const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

export const removeItem = <T,>(list: T[], index: number): T[] =>
  list.filter((_, position) => position !== index);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^(https?:\/\/|\/|#|mailto:|tel:)/i;

export function validateContent(content: SiteContent): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = (path: string, value: string, label: string) => {
    if (!value || !value.trim()) errors[path] = `${label} نمی‌تواند خالی باشد.`;
  };

  required("meta.brand", content.meta.brand, "نام برند");
  required("meta.seoTitle", content.meta.seoTitle, "عنوان سئو");
  required("hero.lines.0", content.hero.lines[0], "خط اول تیتر");
  required("hero.lines.1", content.hero.lines[1], "خط دوم تیتر");
  required("about.title", content.about.title, "عنوان درباره");

  if (!EMAIL.test(content.contact.email)) errors["contact.email"] = "ایمیل معتبر نیست.";

  content.socials.forEach((social, index) => {
    required(`socials.${index}.name`, social.name, "نام کانال");
    required(`socials.${index}.platform`, social.platform, "پلتفرم");
    if (!URL_PATTERN.test(social.href) || social.href.trim().length < 4) {
      errors[`socials.${index}.href`] = "نشانی باید با https:// یا / شروع شود.";
    }
  });

  if (content.work.items.length === 0) {
    errors["work.items"] = "حداقل یک نمونه‌کار اضافه کنید.";
  }

  content.work.items.forEach((item, index) => {
    const base = `work.items.${index}`;
    required(`${base}.name`, item.name, "نام پروژه");
    required(`${base}.title`, item.title, "تیتر پروژه");
    if (item.published !== false) {
      required(`${base}.image`, item.image, "تصویر پروژه");
      required(`${base}.description`, item.description, "توضیح کوتاه");
    }
  });

  content.services.items.forEach((item, index) => {
    required(`services.items.${index}.title`, item.title, "عنوان خدمت");
  });

  content.principles.forEach((principle, index) => {
    required(`principles.${index}.title`, principle.title, "عنوان اصل");
  });

  return errors;
}

/** Fields a work item needs before it can go live. Drafts may stay incomplete. */
export function missingWorkFields(item: WorkItem): string[] {
  const missing: string[] = [];
  if (!item.name.trim()) missing.push("نام برند");
  if (!item.title.trim()) missing.push("تیتر");
  if (item.published !== false) {
    if (!item.image.trim()) missing.push("تصویر");
    if (!item.description.trim()) missing.push("توضیح کوتاه");
  }
  return missing;
}

export const ROLE_LABELS = {
  owner: "مالک",
  editor: "ویرایشگر",
  viewer: "بازدیدکننده",
} as const;

export const ROLE_DESCRIPTIONS = {
  owner: "دسترسی کامل: محتوا، نمونه‌کارها، رسانه، پشتیبان‌گیری و بازنشانی.",
  editor: "ویرایش محتوا، نمونه‌کارها و بارگذاری تصویر؛ بدون بازنشانی محتوا.",
  viewer: "فقط مشاهدهٔ پنل و اطلاعات؛ هیچ تغییری ذخیره نمی‌شود.",
} as const;

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return "—";
  const seconds = Math.round((Date.now() - date) / 1000);
  if (seconds < 60) return "همین حالا";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} روز پیش`;
  return formatDate(value);
}

export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "۰";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
