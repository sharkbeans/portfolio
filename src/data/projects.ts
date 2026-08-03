export type Project = {
  slug: string;
  title: string;
  description: string;
  sourceVisibility: "public" | "private";
  repositoryUrl?: string;
  liveUrl?: string;
  status?: string;
  technologies: string[];
  featured: boolean;
  screenshots?: string[];
};

export const projects: Project[] = [
  {
    slug: "objekt-tools",
    title: "objekt.my / objekt-tools",
    description:
      "A public TypeScript project for Cosmo Objekt collectors with tools for trades, lists, collection tracking, custom card generation, proofshots, and random spins.",
    sourceVisibility: "public",
    repositoryUrl: "https://github.com/sharkbeans/objekt-tools",
    liveUrl: "https://objekt.my",
    status: "Active",
    technologies: [
      "TypeScript",
      "Next.js",
      "Drizzle ORM",
      "PostgreSQL",
      "Playwright",
    ],
    featured: true,
    screenshots: ["/assets/screenshots/objekt-tools-overview.svg"],
  },
  {
    slug: "mybeli",
    title: "MyBeli",
    description:
      "A multi-client catalog and inventory system for small shop owners who need a public catalog that stays current without constantly resending PDF files.",
    sourceVisibility: "private",
    status: "Private / active",
    technologies: ["Elixir"],
    featured: true,
    screenshots: [
      "/assets/screenshots/mybeli-dashboard.svg",
      "/assets/screenshots/mybeli-architecture.svg",
    ],
  },
  {
    slug: "retrocam",
    title: "RetroCam",
    description:
      "A placeholder lab experiment for browser-based retro camera filters and CCD-style image processing.",
    sourceVisibility: "private",
    status: "Placeholder",
    technologies: [],
    featured: false,
  },
];

export const featuredProjects = projects.filter((project) => project.featured);
export const visibleProjects = projects.filter((project) => project.slug !== "retrocam");
