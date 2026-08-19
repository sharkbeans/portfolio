import projectsData from "./projects.json";

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

export const projects: Project[] = projectsData as Project[];

export const featuredProjects = projects.filter((project) => project.featured);
export const visibleProjects = projects.filter((project) => project.slug !== "retrocam");
