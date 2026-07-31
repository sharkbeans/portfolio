export type UsesEntry = {
  name: string;
  detail: string;
};

export type UsesSection = {
  title: string;
  intro?: string;
  entries: UsesEntry[];
};

export const usesSections: UsesSection[] = [
  {
    title: "Software",
    intro:
      "Only a few tools are confirmed so far, so the rest stay as visible placeholders until they are replaced.",
    entries: [
      { name: "OS", detail: "Linux" },
      { name: "Browser", detail: "Firefox" },
      { name: "Editor", detail: "VS Code" },
      { name: "Version control", detail: "Git" },
      { name: "Notes", detail: "[ADD NOTES APP]" },
    ],
  },
  {
    title: "Development",
    entries: [
      { name: "Frontend", detail: "TypeScript, JavaScript, Astro" },
      { name: "Other stack", detail: "Elixir" },
      { name: "Game-flavored web experiments", detail: "KAPLAY" },
      { name: "Terminal", detail: "[ADD TERMINAL]" },
      { name: "Fonts", detail: "[ADD CODING FONT]" },
    ],
  },
  {
    title: "Desktop",
    entries: [
      { name: "Windowing / desktop", detail: "[ADD DESKTOP SETUP]" },
      { name: "Shell", detail: "[ADD SHELL]" },
      { name: "Dotfiles", detail: "[ADD PUBLIC DOTFILES URL]" },
    ],
  },
  {
    title: "Hardware",
    entries: [
      { name: "Main machine", detail: "[ADD HARDWARE DETAILS]" },
      { name: "Keyboard", detail: "[ADD KEYBOARD DETAILS]" },
      { name: "Audio", detail: "[ADD AUDIO DETAILS]" },
    ],
  },
  {
    title: "Other tools",
    entries: [
      { name: "Camera / imaging", detail: "[ADD TOOL]" },
      { name: "Collector workflow", detail: "[ADD TOOL]" },
      { name: "General utility", detail: "[ADD TOOL]" },
    ],
  },
];
