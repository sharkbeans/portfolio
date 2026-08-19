// Some CMS text fields (project descriptions, profile blurbs, uses intros)
// may contain inline HTML, e.g. a link. Meta tags need plain text.
export const stripHtml = (html: string) => html.replace(/<[^>]+>/g, "");
