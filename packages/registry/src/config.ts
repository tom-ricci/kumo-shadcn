// Where the registry lives, in one place (the generator, the local test
// server and the directory check read it).

/** The repository. */
export const HOMEPAGE = "https://github.com/tom-ricci/kumo-shadcn";
/** The Worker that serves the registry (public/) and the docs page. */
export const SITE = "https://kumo-shadcn.thomasricci.dev";
/** Base URL of the item files; registryDependencies point here. */
export const BASE_URL = `${SITE}/r`;
/** The registry's namespace. registry.json's name must match it (without the @). */
export const NAMESPACE = "@kumo-shadcn";
