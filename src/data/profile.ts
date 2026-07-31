export const profile = {
  handle: "sharkbeans",
  siteLabel: "sharkbeans.dev",
  site: "https://example.com",
  firstName: "Juny",
  introHeading: "Hi, I'm Juny.",
  intro:
    "I build practical web products, collector tools, and unusual browser experiences.",
  homeBlurb:
    "This is a small personal home for project notes, works in progress, the tools I use, and experiments that feel worth keeping around.",
  aboutIntro:
    "I like building small web systems that stay understandable, useful, and a little bit playful.",
  emailLabel: "[ADD PUBLIC EMAIL]",
  github: "https://github.com/sharkbeans",
  sourceRepository: "[ADD PUBLIC REPOSITORY URL]",
} as const;

export type Profile = typeof profile;
