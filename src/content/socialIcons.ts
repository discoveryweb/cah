import instagram from "../assets/social/instagram.svg";
import telegram from "../assets/social/telegram.svg";
import whatsapp from "../assets/social/whatsapp.svg";
import type { SocialIcon } from "./types";

export const SOCIAL_ICONS: Record<SocialIcon, string> = {
  telegram,
  instagram,
  whatsapp,
  link: telegram,
};

export const socialIcon = (icon: SocialIcon | string | undefined) =>
  SOCIAL_ICONS[(icon as SocialIcon) ?? "telegram"] ?? telegram;
