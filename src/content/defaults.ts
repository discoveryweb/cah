import auraImage from "../assets/aura.webp";
import heroStill from "../assets/hero-still.webp";
import orbitImage from "../assets/orbit.webp";
import somaImage from "../assets/soma.webp";
import studioNight from "../assets/studio-night.webp";
import type { SiteContent } from "./types";

/**
 * The single source of truth for the site's editable copy. Everything the admin
 * panel can change is seeded from here, so a fresh install always renders the
 * designed site, and a reset simply drops back to this document.
 */
export const DEFAULT_CONTENT: SiteContent = {
  meta: {
    brand: "CAHEN",
    tagline: "DIGITAL STUDIO",
    seoTitle: "کاهن — استودیوی مستقل طراحی و توسعهٔ دیجیتال",
    seoDescription:
      "کاهن یک استودیوی مستقل طراحی و توسعه است؛ برندها و محصولات دیجیتال را از دلِ مسئله طراحی می‌کنیم.",
  },
  contact: {
    email: "info@cahen.ir",
    /**
     * Left empty on purpose: the number the studio shared is its WhatsApp
     * line, published as a chat link below, not as a dial-out number in the
     * footer. Fill this in the panel to also publish a `tel:` link.
     */
    phone: "",
    handle: "@CAHENWEB",
    city: "تهران، ایران",
    latinCity: "TEHRAN / IRAN",
    responseTime: "کمتر از یک روز کاری",
  },
  nav: [
    { id: "home", label: "خانه", latin: "Index" },
    { id: "work", label: "کارها", latin: "Work" },
    { id: "services", label: "توانمندی‌ها", latin: "Services" },
    { id: "studio", label: "استودیو", latin: "Studio" },
    { id: "contact", label: "تماس", latin: "Contact" },
  ],
  socials: [
    {
      name: "تلگرام",
      platform: "Telegram",
      href: "https://t.me/CAHENWEB",
      color: "#3fb6f2",
      icon: "telegram",
    },
    {
      name: "اینستاگرام",
      platform: "Instagram",
      href: "https://www.instagram.com/CAHENWEB/",
      color: "#f2688c",
      icon: "instagram",
    },
    {
      /* wa.me takes the number in E.164 digits, without the plus. */
      name: "واتساپ",
      platform: "WhatsApp",
      href: "https://wa.me/989023841612",
      color: "#4fe08a",
      icon: "whatsapp",
    },
  ],
  hero: {
    status: "پذیرش پروژه — همیشه باز",
    coordinates: "TEHRAN, IR — 35.6892° N / 51.3890° E",
    lines: ["دیده‌شدن،", "حقِ کارِ خوب است"],
    annotation: "FORM / I",
    translation: "The work deserves to be seen.",
    translationLabel: "CAHEN — STUDIO NOTE",
    lede: "ما در *CAHEN* برندها و محصولات دیجیتال را از دلِ مسئله طراحی می‌کنیم؛ با استراتژی روشن، فرمِ دقیق و کدی که طرح را همان‌قدر که هست، نشان می‌دهد.",
    primaryCta: "شروع یک پروژه",
    secondaryCta: "دیدن کارها",
    figure: {
      image: heroStill,
      alt: "ترکیب‌بندی استودیویی از فرم‌های کاغذی و یک دایرهٔ بنفش روی زمینهٔ کاغذ",
      index: "SOMA / 2025",
      tag: "SELECTED WORK",
      caption: "یک کار منتخب از مجموعهٔ ۲۰۲۵",
    },
    ticker: [
      "استراتژی برند",
      "طراحی محصول",
      "تجربهٔ کاربری",
      "رابط کاربری",
      "توسعهٔ فرانت‌اند",
      "هویت بصری",
      "سیستم طراحی",
      "جهت‌دهی هنری",
    ],
  },
  about: {
    title: "طراحی از دلِ مسئله، نه از دلِ *قالب*.",
    note: "کاهن یک استودیوی مستقل طراحی و توسعه است؛ کوچک به‌اندازه‌ای که هر پروژه را خودمان بسازیم، بزرگ به‌اندازه‌ای که از پسِ مسائل واقعی بربیاییم.",
    identityCaption: "نشان کاهن — پرتره‌ای از ذرات",
    statementLines: [
      "ما به برندها کمک می‌کنیم",
      "از دایرهٔ شلوغِ *«شبیه بقیه»*",
      "بیرون بیایند — و دیده شوند.",
    ],
    copy: [
      "هر پروژه با یک گفت‌وگوی صادقانه شروع می‌شود: شما از هدف می‌گویید، ما از پرسش‌هایی که مسیر را روشن می‌کنند. از آن نقطه، استراتژی، فرم و کد را در یک خط پیش می‌بریم تا چیزی ساخته شود که هم درست کار کند و هم به‌یاد بماند.",
      "ما به قالب‌های آماده اعتقادی نداریم. هر برند، زبانِ خودش را دارد؛ کارِ ما پیدا کردنِ آن زبان و ساختنِ سیستمی است که در هر اندازه و هر نقطهٔ تماس، همان صدا را داشته باشد.",
    ],
    ctaLabel: "بیشتر دربارهٔ استودیو",
    portrait: {
      image: studioNight,
      alt: "میز کار استودیو در نور شبانهٔ بنفش؛ برگه‌های چاپ‌شده، خط‌کش فلزی و دفترچهٔ نارنجی زیر نور بنفش",
      caption: "دفتر ما — تهران",
    },
  },
  work: {
    title: "کارهایی که *دیده* شدند",
    note: "هر پروژه با یک مسئلهٔ مشخص شروع شده و با یک سیستمِ قابلِ استفاده تمام شده است. اسکرول کنید تا حلقهٔ کارها بچرخد، یا روی کارتِ جلو بزنید تا پروژه باز شود.",
    eyebrow: "SELECTED WORK",
    hint: "اسکرول کنید تا بچرخد",
    footNote: "{count} پروژه در این مجموعه — آرشیو کامل با درخواست",
    archiveCta: "درخواست آرشیو کامل",
    items: [
      {
        id: "soma",
        name: "SOMA",
        title: "خرید، با تجربهٔ یک نمایشگاه",
        category: "E-COMMERCE / PRODUCT",
        year: "۲۰۲۵",
        sector: "خرده‌فروشی دیجیتال",
        role: "استراتژی · تجربهٔ کاربری · رابط کاربری",
        description:
          "بازطراحی یک فروشگاه آنلاین با تمرکز بر روایت محصول و مسیر خریدی که کاربر را همراه می‌کند.",
        intro:
          "SOMA پیش از این یک فروشگاه بود؛ مجموعه‌ای از محصولات که کنار هم چیده شده بودند. کاری که انجام دادیم، تبدیل آن به یک نمایشگاه بود: فضایی که در آن هر محصول، دلیلِ بودنش را روایت می‌کند.",
        challenge:
          "نرخ رهاکردن سبد خرید بالا بود و کاربران در مرحلهٔ انتخاب اندازه، مسیر را رها می‌کردند. مسئله، کمبود امکانات نبود؛ نبودِ اطمینان بود.",
        result:
          "با بازطراحی مسیر محصول، راهنمای اندازهٔ تعاملی و کاهش گام‌های پرداخت، تجربه‌ای ساخته شد که در آن کاربر می‌داند دقیقاً چه می‌خرد.",
        metrics: [
          { value: "۳۸٪", label: "رشد تکمیل سفارش" },
          { value: "۲٫۴×", label: "زمان حضور در صفحهٔ محصول" },
          { value: "۶→۳", label: "کاهش گام‌های پرداخت" },
        ],
        deliverables: ["معماری اطلاعات", "نمونهٔ تعاملی", "سیستم طراحی", "توسعهٔ فرانت‌اند"],
        image: somaImage,
        alt: "طبیعت بی‌جان از گلدان سرامیکی و شیشهٔ کهربایی در نور گرم — کانسپت فروشگاه SOMA",
        published: true,
      },
      {
        id: "orbit",
        name: "ORBIT",
        title: "هویتی که حرکت می‌کند",
        category: "FINTECH / BRAND SYSTEM",
        year: "۲۰۲۴",
        sector: "خدمات مالی",
        role: "هویت بصری · وب‌سایت · حرکت",
        description:
          "یک سیستم هویتی پویا برای پلتفرم مالی ORBIT؛ از نشانه و تایپوگرافی تا زبان حرکت در محصول.",
        intro:
          "ORBIT در بازاری فعالیت می‌کند که همه شبیه هم حرف می‌زنند. می‌خواستیم برندی بسازیم که پیش از خواندنِ متن، از طریق فرم و حرکت شناخته شود.",
        challenge:
          "هویت قبلی در کوچک‌ترین اندازه‌ها ناخوانا بود و در محصول دیجیتال هیچ نسخهٔ حرکتی نداشت. تیم محصول هم برای هر صفحه، زبان بصری خودش را ساخته بود.",
        result:
          "یک سیستم نشانهٔ شبکه‌ای، پالت محدود و کتاب حرکت نوشتیم؛ سپس آن را در وب‌سایت و اپلیکیشن پیاده کردیم تا هر نقطهٔ تماس، یک صدا داشته باشد.",
        metrics: [
          { value: "۱", label: "سیستم، همهٔ نقاط تماس" },
          { value: "۴۲", label: "کامپوننت مستندشده" },
          { value: "۲ هفته", label: "زمان پیاده‌سازی در تیم" },
        ],
        deliverables: ["نشانه و لوگوتایپ", "تایپوگرافی", "کتاب برند", "زبان حرکت"],
        image: orbitImage,
        alt: "کمان برنجی و کرهٔ سیاه روی سکو — کانسپت هویت ORBIT",
        published: true,
      },
      {
        id: "aura",
        name: "AURA",
        title: "نوری که برند می‌شود",
        category: "BEAUTY / IDENTITY",
        year: "۲۰۲۴",
        sector: "مراقبت پوست",
        role: "جهت‌دهی هنری · هویت · وب",
        description: "هویت بصری و تجربهٔ دیجیتال برندی که می‌خواست دربارهٔ نور، ماده و آرامش حرف بزند.",
        intro:
          "AURA یک برند مراقبت از پوست است که محصولش را بر اساس نور و بافت توصیف می‌کند. زبان بصری آن را از همان دو عنصر ساختیم: نور به‌عنوان رنگ، بافت به‌عنوان فرم.",
        challenge:
          "دستهٔ محصولات این حوزه اشباع شده و همه از یک زیبایی‌شناسی مشابه استفاده می‌کنند. برند به تمایزی نیاز داشت که در قفسه و در فید اینستاگرام دیده شود.",
        result:
          "یک جهان بصری گرم و مینیمال ساختیم؛ با تایپوگرافی بزرگ، فضای منفی سخاوتمندانه و تصویری که محصول را در نور، نه در استودیو، نشان می‌دهد.",
        metrics: [
          { value: "۲٫۹×", label: "رشد تعامل در لانچ" },
          { value: "۱۱", label: "قالب محتوای بصری" },
          { value: "۱", label: "زبان، از بسته تا وب" },
        ],
        deliverables: ["هویت بصری", "بسته‌بندی", "جهت‌دهی هنری", "وب‌سایت"],
        image: auraImage,
        alt: "کرهٔ شیشه‌ای و نور شکسته روی کاغذ — کانسپت هویت AURA",
        published: true,
      },
    ],
  },
  services: {
    title: "آنچه می‌سازیم، با *دقت*.",
    note: "چهار حوزه که در کنار هم یک محصول کامل می‌سازند: از اولین پرسش تا آخرین پیکسلِ منتشرشده. برای دیدن جزئیات هر حوزه، روی آن باز کنید.",
    ctaLabel: "شروع این خدمت",
    foot: "هر پروژه، ترکیبی از این چهار حوزه است — نه یک انتخاب از میان آن‌ها",
    items: [
      {
        title: "استراتژی و طراحی محصول",
        latin: "PRODUCT STRATEGY",
        text: "قبل از رسمِ اولین خط، باید بدانیم برای چه کسی و برای چه چیزی طراحی می‌کنیم. پژوهش، تعریف مسئله و ترسیم مسیر محصول، پایهٔ همهٔ کارهای ماست.",
        deliverables: ["پژوهش کاربر", "نقشهٔ سفر", "معماری اطلاعات", "نمونهٔ اولیه"],
        duration: "۳ تا ۵ هفته",
        suited: "محصول جدید یا بازطراحی",
        option: "استراتژی و طراحی محصول",
      },
      {
        title: "طراحی رابط و تجربهٔ کاربری",
        latin: "INTERFACE & EXPERIENCE",
        text: "رابط‌هایی که کاربر را راهنمایی می‌کنند، نه سرگرم. از وایرفریم تا سیستم طراحی، هر صفحه با دقت در سلسله‌مراتب و خوانایی ساخته می‌شود.",
        deliverables: ["وایرفریم", "سیستم طراحی", "رابط واکنش‌گرا", "نمونه‌سازی تعاملی"],
        duration: "۴ تا ۸ هفته",
        suited: "وب‌سایت و اپلیکیشن",
        option: "طراحی رابط و تجربهٔ کاربری",
      },
      {
        title: "توسعهٔ فرانت‌اند",
        latin: "FRONT-END ENGINEERING",
        text: "طرحی که در مرورگر، همان‌قدر دقیق نباشد که در فایل طراحی بود، تمام نشده است. ما با React، انیمیشن‌های سبک و کدِ تمیز، طرح را زنده می‌کنیم.",
        deliverables: ["React / TypeScript", "حرکت و تعامل", "دسترس‌پذیری", "بهینه‌سازی سرعت"],
        duration: "۳ تا ۶ هفته",
        suited: "پیاده‌سازی طرح نهایی",
        option: "توسعهٔ فرانت‌اند",
      },
      {
        title: "هویت بصری و برندینگ",
        latin: "BRAND & IDENTITY",
        text: "برند، چیزی بیشتری از یک لوگو است؛ یک زبان است. نشانه، تایپوگرافی، رنگ، تصویر و لحن را چنان می‌سازیم که در هر نقطهٔ تماس، یک صدا داشته باشند.",
        deliverables: ["نشانه و لوگوتایپ", "تایپوگرافی", "پالت و گرافیک", "راهنمای برند"],
        duration: "۵ تا ۹ هفته",
        suited: "برند در حال رشد",
        option: "هویت بصری و برندینگ",
      },
    ],
  },
  studio: {
    title: "استودیوی کوچک، وسواسِ *بزرگ*.",
    note: "ما یک تیمِ کوچکِ ثابت هستیم؛ بدون واسطه، بدون لایه‌های اضافه. کسی که با شما حرف می‌زند، همان کسی است که طراحی می‌کند و کد را می‌نویسد.",
    statementLines: [
      "ما با ایده‌های بزرگ",
      "شروع نمی‌کنیم؛ با",
      "*پرسش‌های درست* شروع می‌کنیم.",
    ],
    copy: [
      "کاهن در سال ۱۳۹۸ با یک ایدهٔ ساده شروع شد: طراحی باید مسئله را حل کند، نه اینکه فقط خوب به نظر برسد. امروز همان ایده، شکل یک استودیوی مستقل است که برندها، محصولات و تجربه‌های دیجیتال می‌سازد.",
      "ما در تهران کار می‌کنیم و با تیم‌هایی در سراسر جهان همکاری می‌کنیم. ابزارمان گفت‌وگوی شفاف، پژوهشِ دقیق و وسواسی است که در جزئیاتی دیده می‌شود که شاید کسی نامشان را نبرد.",
    ],
    facts: [
      { label: "تأسیس", value: "۱۳۹۸", latin: "FOUNDED" },
      { label: "تیم ثابت", value: "۴ نفر", latin: "CORE TEAM" },
      { label: "موقعیت", value: "تهران", latin: "TEHRAN" },
      { label: "زبان کار", value: "فارسی / انگلیسی", latin: "LANGUAGES" },
    ],
    linkLabel: "کارهایی که این اصول را نشان می‌دهند",
    ctaText: "اگر مسئله‌ای دارید که فکر می‌کنید وقتِ حل‌شدنش رسیده، یک پیام کوتاه کافی است.",
    ctaLabel: "بیایید دربارهٔ همکاری حرف بزنیم",
    marquee: ["CAHEN", "DIGITAL STUDIO", "TEHRAN", "DESIGN & CODE", "SINCE 2019"],
  },
  contactSection: {
    availability: "همیشه پذیرای همکاری‌های تازه",
    headline: "بیایید چیزی بسازیم که *دیده شود.*",
    lead: "هر همکاری با یک پیام کوتاه شروع می‌شود. بنویسید چه می‌سازید، در چه مرحله‌ای هستید و چه چیزی باید تغییر کند؛ بقیهٔ مسیر را با هم می‌چینیم.",
    ctaLabel: "شروع گفت‌وگو",
    telegramLabel: "تلگرام",
    responseLabel: "پاسخ‌گویی",
    socialEyebrow: "CAHEN / SOCIAL CHANNELS",
    socialTitle: "جایی که راحت‌ترید،",
    socialTitleAccent: "پیدایمان کنید.",
    socialText: "سه مسیر، یک تیم. هر کدام را که انتخاب کنید، همان آدم‌هایی پاسخ می‌دهند که پروژه را می‌سازند.",
  },
  principles: [
    {
      title: "فکر پیش از فرم",
      text: "زیبایی زمانی ماندگار است که بر پایهٔ هدف ساخته شود، نه بر پایهٔ مد روز.",
    },
    {
      title: "جزئیات با دلیل",
      text: "از فاصله‌ها تا حرکت‌ها؛ هیچ جزئیاتی تصادفی نیست و هر انتخاب قابل توضیح است.",
    },
    {
      title: "ساختن با هم",
      text: "بهترین نتیجه از گفت‌وگوی شفاف، بازخورد صادقانه و همکاری واقعی شکل می‌گیرد.",
    },
  ],
  footer: {
    statement:
      "استودیوی مستقل طراحی و توسعهٔ دیجیتال. برندها و محصولاتی می‌سازیم که در اولین نگاه، خودشان را نشان می‌دهند.",
    sitemapLabel: "SITEMAP",
    elsewhereLabel: "ELSEWHERE",
    directLabel: "DIRECT",
    credit: "DESIGNED & BUILT IN-HOUSE",
    rights: "همهٔ حقوق محفوظ است.",
  },
  order: {
    title: "شروع یک همکاری",
    description: "چند خط دربارهٔ پروژه‌تان بنویسید؛ در کمتر از یک روز کاری پاسخ می‌دهیم.",
    submitLabel: "ارسال درخواست",
  },
};

/** Persian digits for counts inside labels such as "{count} پروژه". */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
export const toPersianNumber = (value: number | string) =>
  String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);

export const fillTemplate = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key) =>
    values[key] === undefined ? match : String(values[key])
  );
