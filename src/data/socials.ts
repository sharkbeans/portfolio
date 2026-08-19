import socialsData from "./socials.json";

export type SocialLink = {
  label: string;
  href?: string;
  note?: string;
};

export const socials: SocialLink[] = socialsData as SocialLink[];
