import { profile } from "./profile";

export type SocialLink = {
  label: string;
  href?: string;
  note?: string;
};

export const socials: SocialLink[] = [
  {
    label: "GitHub",
    href: profile.github,
  },
  // {
  //   label: "LinkedIn",
  //   note: "[ADD PUBLIC PROFILE URL]",
  // },
  // {
  //   label: "Other profile",
  //   note: "[ADD PUBLIC PROFILE URL]",
  // },
];
