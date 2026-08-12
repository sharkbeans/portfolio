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
      "Better Auth",
      "Redis",
    ],
    featured: true,
    screenshots: ["/assets/screenshots/objekt-tools-overview.png"],
  },
  {
    slug: "mybeli",
    title: "MyBeli",
    description:
      "A multi-client catalog and inventory system for small shop owners who need a public catalog that stays current without constantly resending PDF files.",
    sourceVisibility: "private",
    liveUrl: "https://mybeli.my",
    status: "Live / active",
    technologies: [
      "Elixir",
      "Phoenix",
      "Phoenix LiveView",
      "Ecto",
      "PostgreSQL",
      "Docker",
    ],
    featured: true,
    screenshots: [
      "/assets/screenshots/mybeli-catalog.jpg",
      "/assets/screenshots/mybeli-architecture.svg",
    ],
  },
  {
    slug: "objekt-tcg",
    title: "objekt-tcg",
    description:
      "An abandoned side experiment: TCG-style pack opening for Cosmo objekt collectors, mostly built as an excuse to play with real-time 3D (.glb model) rendering in the browser.",
    sourceVisibility: "private",
    status: "Abandoned / experiment",
    technologies: [
      "TypeScript",
      "Next.js",
      "React Three Fiber",
      "Three.js",
      "Drizzle ORM",
      "PostgreSQL",
    ],
    featured: false,
    screenshots: ["/assets/screenshots/objekt-tcg-pack.png"],
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
