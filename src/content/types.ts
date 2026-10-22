export interface NavItem {
  id: string;
  label: string;
  latin: string;
}

export type SocialIcon = "telegram" | "instagram" | "whatsapp" | "link";

export interface SocialLink {
  name: string;
  platform: string;
  href: string;
  color: string;
  icon: SocialIcon;
}

export interface Metric {
  value: string;
  label: string;
}

export interface WorkItem {
  id: string;
  name: string;
  title: string;
  category: string;
  year: string;
  sector: string;
  role: string;
  description: string;
  intro: string;
  challenge: string;
  result: string;
  metrics: Metric[];
  deliverables: string[];
  image: string;
  alt: string;
  /** Unpublished work stays out of the public gallery. */
  published: boolean;
}

export interface ServiceItem {
  title: string;
  latin: string;
  text: string;
  deliverables: string[];
  duration: string;
  suited: string;
  option: string;
}

export interface Principle {
  title: string;
  text: string;
}

export interface StudioFact {
  label: string;
  value: string;
  latin: string;
}

export interface SiteContent {
  meta: {
    brand: string;
    tagline: string;
    seoTitle: string;
    seoDescription: string;
  };
  contact: {
    email: string;
    phone: string;
    handle: string;
    city: string;
    latinCity: string;
    responseTime: string;
  };
  nav: NavItem[];
  socials: SocialLink[];
  hero: {
    status: string;
    coordinates: string;
    lines: [string, string];
    annotation: string;
    translation: string;
    translationLabel: string;
    lede: string;
    primaryCta: string;
    secondaryCta: string;
    /**
     * Legacy hero still. The hero is a full-bleed film now; the field stays in
     * the content model so older saved documents keep validating.
     */
    figure: {
      image: string;
      alt: string;
      index: string;
      tag: string;
      caption: string;
    };
    ticker: string[];
  };
  about: {
    title: string;
    note: string;
    identityCaption: string;
    statementLines: string[];
    copy: string[];
    ctaLabel: string;
    portrait: {
      image: string;
      alt: string;
      caption: string;
    };
  };
  work: {
    title: string;
    note: string;
    eyebrow: string;
    hint: string;
    footNote: string;
    archiveCta: string;
    items: WorkItem[];
  };
  services: {
    title: string;
    note: string;
    ctaLabel: string;
    foot: string;
    items: ServiceItem[];
  };
  studio: {
    title: string;
    note: string;
    statementLines: string[];
    copy: string[];
    facts: StudioFact[];
    linkLabel: string;
    ctaText: string;
    ctaLabel: string;
    marquee: string[];
  };
  contactSection: {
    availability: string;
    headline: string;
    lead: string;
    ctaLabel: string;
    telegramLabel: string;
    responseLabel: string;
    socialEyebrow: string;
    socialTitle: string;
    socialTitleAccent: string;
    socialText: string;
  };
  principles: Principle[];
  footer: {
    statement: string;
    sitemapLabel: string;
    elsewhereLabel: string;
    directLabel: string;
    credit: string;
    rights: string;
  };
  order: {
    title: string;
    description: string;
    submitLabel: string;
  };
}

export type AdminRole = "owner" | "editor" | "viewer";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  source?: "env" | "panel";
  mustChangePassword?: boolean;
  createdAt?: string | null;
}

export type SmsStatus = "sent" | "partial" | "failed" | "pending";

export interface OrderSms {
  status: SmsStatus;
  attempts: number;
  parts: number;
  sentParts: number;
  error: string | null;
  lastAttemptAt: string | null;
  sentAt: string | null;
  references?: string[];
}

export interface OrderRecord {
  id: string;
  code: string;
  at: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  sms: OrderSms;
}

export interface SmsSummary {
  configured: boolean;
  missing: string[];
}

export interface MediaEntry {
  name: string;
  size: number;
  type: string;
  at: string;
  by: string;
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}
