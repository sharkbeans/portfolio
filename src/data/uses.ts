import usesData from "./uses.json";

export type UsesEntry = {
  name: string;
  detail: string;
  href?: string;
};

export type UsesSection = {
  title: string;
  intro?: string;
  entries: UsesEntry[];
};

export const usesSections: UsesSection[] = usesData as UsesSection[];
