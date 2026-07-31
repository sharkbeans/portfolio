const browserOnlyMessage =
  "GitHub Pages serves static files only. Secret-backed requests must move to an external API or build-time automation.";

export type ApiCapability = {
  name: string;
  description: string;
  safeInBrowser: boolean;
};

export const plannedApiCapabilities: ApiCapability[] = [
  {
    name: "Public browser fetches",
    description:
      "Use this for CORS-friendly public endpoints such as profile metadata or public activity feeds.",
    safeInBrowser: true,
  },
  {
    name: "Secret-backed requests",
    description:
      "Use an external Worker, Elixir service, or GitHub Action for requests that need tokens, private keys, or rate-limit protection.",
    safeInBrowser: false,
  },
];

export function assertBrowserSafeFetch(isSafe: boolean) {
  if (!isSafe) {
    throw new Error(browserOnlyMessage);
  }
}

export async function fetchPublicJson<T>(input: RequestInfo | URL): Promise<T> {
  const response = await fetch(input, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const apiNotes = {
  browserOnlyMessage,
};
