/**
 * The frontend only ever reads static JSON files — it has no knowledge of
 * Yahoo, OAuth, or any credentials. This module just decides which folder
 * to read from.
 *
 * VITE_USE_MOCK_DATA defaults to "true" for local development so the UI can
 * be built without ever touching the Yahoo API. The CI build sets it to
 * "false" once real data exists.
 */

export const IS_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== "false";

/**
 * Manager profiles are an independent feature because Yahoo may not expose
 * the profile statistics through the documented Fantasy API. Defaults on so
 * the feature is visible until the deployment sets the GitHub variable to
 * false.
 */
export const IS_MANAGER_PROFILE_ENABLED = import.meta.env.VITE_ENABLE_MANAGER_PROFILES !== "false";

const DATA_DIR = IS_MOCK_DATA ? "data/mock" : "data/current";

function dataUrl(file: string): string {
  return `${import.meta.env.BASE_URL}${DATA_DIR}/${file}`;
}

export async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(dataUrl(file));
  if (!res.ok) {
    throw new Error(`Failed to load ${file} (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as T;
}
