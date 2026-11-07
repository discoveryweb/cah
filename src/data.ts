/**
 * Navigation is the one thing the site chrome needs before the content document
 * resolves: the header, the mobile dock and the scroll spy all mount with it.
 * Everything else that used to live here (work, services, contact) is seeded
 * from `src/content/defaults.ts`, which is also what the panel edits — having a
 * second copy meant two places to change and one of them always drifting.
 */
export const NAV_LINKS = [
  { id: "home", label: "خانه", latin: "Index" },
  { id: "work", label: "کارها", latin: "Work" },
  { id: "services", label: "توانمندی‌ها", latin: "Services" },
  { id: "animations", label: "انیمیشن‌ها", latin: "Motion" },
  { id: "studio", label: "استودیو", latin: "Studio" },
  { id: "contact", label: "تماس", latin: "Contact" },
] as const;
