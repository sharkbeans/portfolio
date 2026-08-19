import profileData from "./profile.json";

export type Profile = {
  handle: string;
  siteLabel: string;
  site: string;
  firstName: string;
  introHeading: string;
  intro: string;
  homeBlurb: string;
  aboutIntro: string;
  github: string;
  sourceRepository: string;
};

export const profile: Profile = profileData;
