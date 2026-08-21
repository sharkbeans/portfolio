/** How long each favicon frame stays on screen. */
export const FAVICON_FRAME_MS = 500;

/** Frame 0 is the bare prompt, frame 1 adds the underscore. */
const FRAMES = {
  light: [
    `${import.meta.env.BASE_URL}favicon-light-1.png`,
    `${import.meta.env.BASE_URL}favicon-light-2.png`,
  ],
  dark: [
    `${import.meta.env.BASE_URL}favicon-dark-1.png`,
    `${import.meta.env.BASE_URL}favicon-dark-2.png`,
  ],
};

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

let frame = 0;
let timer: number | undefined;

/**
 * Retargets the single <link rel="icon"> the layout already renders rather than
 * appending one, so the head keeps exactly one favicon link.
 */
function paint() {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  link.type = "image/png";
  link.href = FRAMES[prefersDark.matches ? "dark" : "light"][frame]!;
}

export function startAnimatedFavicon() {
  if (timer !== undefined) return;

  // ClientRouter swaps the whole head on navigation, so the incoming page
  // arrives with a fresh link element that has to be repainted. astro:page-load
  // also fires for the initial load, which is what starts the animation.
  document.addEventListener("astro:page-load", paint);
  // The art is transparent, so the ink has to flip with the browser chrome.
  prefersDark.addEventListener("change", paint);

  timer = window.setInterval(() => {
    frame = (frame + 1) % FRAMES.light.length;
    paint();
  }, FAVICON_FRAME_MS);
}
