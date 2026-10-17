import heroImage from "./assets/hero.jpg";
import projectsImage from "./assets/projects.jpg";
import ctaImage from "./assets/cta.jpg";

export const NAV_LINKS = [
  { label: "خانه", href: "#home", id: "home" },
  { label: "پروژه‌ها", href: "#projects", id: "projects" },
  { label: "توانمندی‌ها", href: "#services", id: "services" },
  { label: "رویکرد ما", href: "#approach", id: "approach" },
  { label: "دربارهٔ CAHEN", href: "#about", id: "about" },
  { label: "تماس", href: "#contact", id: "contact" },
] as const;

export const SERVICE_OPTIONS = [
  "استراتژی و طراحی محصول",
  "طراحی رابط و تجربهٔ کاربری",
  "طراحی وب‌سایت",
  "توسعهٔ فرانت‌اند",
  "هویت بصری و برندینگ",
  "بهینه‌سازی و پشتیبانی",
] as const;

export const FEATURES = [
  { icon: "target", number: "1", title: "هدف‌محور", text: "هر تصمیم، در خدمت مسئلهٔ واقعی." },
  { icon: "layers", number: "2", title: "یکپارچه", text: "از ایدهٔ اولیه تا آخرین جزئیات." },
  { icon: "fingerprint", number: "3", title: "به‌یادماندنی", text: "زیبایی با هویت، نه فقط تزئین." },
  { icon: "gauge", number: "4", title: "آمادهٔ رشد", text: "تجربه‌ای سریع، واکنش‌گرا و پایدار." },
] as const;

export const SERVICES = [
  {
    icon: "compass",
    number: "1",
    title: "استراتژی و طراحی محصول",
    text: "شناخت مسئله، ترسیم مسیر و تعریف تجربه‌ای که به نیاز کاربر پاسخ می‌دهد.",
    option: "استراتژی و طراحی محصول",
  },
  {
    icon: "panels",
    number: "2",
    title: "طراحی وب و رابط کاربری",
    text: "وب‌سایت‌ها و رابط‌هایی دقیق، منسجم و متناسب با شخصیت برند شما.",
    option: "طراحی رابط و تجربهٔ کاربری",
  },
  {
    icon: "code",
    number: "3",
    title: "توسعهٔ فرانت‌اند",
    text: "تبدیل طرح به تجربه‌ای سریع، واکنش‌گرا و خوش‌ساخت در تمام نمایشگرها.",
    option: "توسعهٔ فرانت‌اند",
  },
  {
    icon: "palette",
    number: "4",
    title: "هویت بصری و برندینگ",
    text: "ساخت زبانی بصری روشن و متمایز برای حضور یکپارچه در فضای دیجیتال.",
    option: "هویت بصری و برندینگ",
  },
] as const;

export const PROJECTS = [
  {
    id: "1",
    label: "SOMA",
    title: "خرید، با تجربه‌ای تازه",
    category: "E-COMMERCE · CONCEPT",
    description: "کانسپت یک فروشگاه دیجیتال با تمرکز بر روایت محصول، وضوح مسیر خرید و تجربهٔ موبایل.",
    tags: ["تجربهٔ خرید", "رابط کاربری", "واکنش‌گرا"],
    image: heroImage,
    alt: "نمای مفهومی یک فروشگاه آنلاین روی نمایشگرهای مختلف",
    tone: "violet",
  },
  {
    id: "2",
    label: "ORBIT",
    title: "فراتر از یک صفحهٔ ساده",
    category: "DIGITAL EXPERIENCE · CONCEPT",
    description: "یک تجربهٔ دیجیتال مفهومی؛ جایی که حرکت، نور و تایپوگرافی به بخشی از هویت محصول تبدیل می‌شوند.",
    tags: ["طراحی تعاملی", "هنر دیجیتال", "سیستم بصری"],
    image: projectsImage,
    alt: "کانسپت تجربهٔ دیجیتال با فرم‌های نورانی بنفش روی لپ‌تاپ",
    tone: "blue",
  },
  {
    id: "3",
    label: "AURA",
    title: "هویتی با حضور روشن",
    category: "BRAND SYSTEM · CONCEPT",
    description: "تمرینی برای ساخت یک زبان بصری منسجم؛ از نشانه و رنگ تا نحوهٔ حضور برند در وب.",
    tags: ["هویت بصری", "طراحی وب", "جهت‌دهی هنری"],
    image: ctaImage,
    alt: "فرم کروی شیشه‌ای با نور بنفش به‌عنوان تصویر کانسپت هویت بصری",
    tone: "plum",
  },
] as const;

export const PROCESS_STEPS = [
  {
    number: "1",
    label: "DISCOVER",
    icon: "search",
    title: "اول، درست می‌فهمیم",
    text: "با پرسش‌های درست، هدف کسب‌وکار، مخاطب و مسئلهٔ اصلی را شفاف می‌کنیم.",
  },
  {
    number: "2",
    label: "DESIGN",
    icon: "layers",
    title: "بعد، مسیر را می‌سازیم",
    text: "ساختار، تجربه و زبان بصری را شکل می‌دهیم؛ سپس جزئیات را با بازخورد دقیق می‌کنیم.",
  },
  {
    number: "3",
    label: "DELIVER",
    icon: "arrow",
    title: "در نهایت، زنده‌اش می‌کنیم",
    text: "طرح را به محصولی واقعی، واکنش‌گرا و آمادهٔ استفاده تبدیل می‌کنیم.",
  },
] as const;

export const STUDIO_VALUES = [
  { number: "A", title: "فکر پیش از فرم", text: "زیبایی زمانی ماندگار است که بر پایهٔ هدف ساخته شود." },
  { number: "B", title: "جزئیات با دلیل", text: "از فاصله‌ها تا حرکت‌ها؛ هیچ جزئیاتی تصادفی نیست." },
  { number: "C", title: "ساختن با هم", text: "بهترین نتیجه از گفت‌وگوی شفاف و همکاری واقعی شکل می‌گیرد." },
] as const;
