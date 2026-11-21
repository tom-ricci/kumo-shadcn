// Theme items, as data. The generator renders each theme into a registry item
// that sets Kumo's color tokens. Pick exactly one theme item per project.
//
// Token names are Kumo's (`color-kumo-base`, `text-color-kumo-subtle`, ...).
// The generator stores each token in a plain variable (`--kumo-base`,
// `--kumo-text-subtle`); kumo-base registers those with Tailwind.
//
// kumo-theme and kumo-cloudflare start from Kumo's own theme CSS
// (theme-kumo.css, theme-fedramp.css), read from the release the registry is
// built from. kumo-binding sets the tokens from shadcn variables instead.

const mix = (a: string, b: string, pct: number) => `color-mix(in oklab, ${a}, ${b} ${pct}%)`;
const alpha = (a: string, pct: number) => `color-mix(in oklab, ${a} ${pct}%, transparent)`;

// `{kumo:<token>}` is replaced with Kumo's own value for that token, for the
// same mode, from the Kumo release the registry is built from.
const kumo = (token: string) => `{kumo:${token}}`;

// Kumo puts white text on brand and danger fills (`!text-white`). shadcn's
// default dark --primary is near-white, so the binding caps the lightness of
// those fills where the browser supports relative colors.
const capL = (v: string, l: number) => `oklch(from ${v} min(l, ${l}) c h)`;
export const RELATIVE_COLOR_SUPPORTS = "(color: oklch(from red l c h))";

// A theme built on Kumo's own token values, plus extra variables per mode
// (set on the same selectors as Kumo's :root / dark tokens).
export interface KumoTheme {
  name: string;
  title: string;
  description: string;
  extras: { light: Record<string, string>; dark: Record<string, string> };
}

export const kumoTheme: KumoTheme = {
  name: "kumo-theme",
  title: "Kumo theme",
  description: "Kumo's own colors and type scale, as Kumo ships them (light, dark, and Kumo's fedramp theme). Install one theme item: kumo-theme, kumo-cloudflare or kumo-binding.",
  extras: { light: {}, dark: {} },
};

// The Cloudflare dashboard's look, and where it is going. Measured in
// November 2026 from the live dashboard's CSS and a survey of 49 dashboard
// pages: its theme tokens equal Kumo's; its sidebar uses the canvas color;
// and every newly migrated hover/selected background uses one shade whatever
// the surface (light 96.5% = Kumo's neutral-125, dark 21% = neutral-900),
// replacing Kumo's tint (97% / 26.9%). kumo-cloudflare applies that shade to
// every interactive state through --kumo-highlight, which the generator
// hooks into Kumo's components (see hookHighlights in generate.ts).
export const kumoCloudflare: KumoTheme = {
  name: "kumo-cloudflare",
  title: "Kumo theme, Cloudflare dashboard variant",
  description: "Kumo's own colors with the Cloudflare dashboard's direction: one highlight shade for every hover and selected background, and a canvas-colored sidebar. Install one theme item: kumo-theme, kumo-cloudflare or kumo-binding.",
  extras: {
    light: { "--kumo-highlight": "var(--color-kumo-neutral-125, oklch(96.5% 0 0))", "--kumo-sidebar-bg": "var(--color-kumo-canvas)" },
    dark: { "--kumo-highlight": "var(--color-neutral-900, oklch(20.5% 0 0))", "--kumo-sidebar-bg": "var(--color-kumo-canvas)" },
  },
};

export interface BindingTheme {
  name: string;
  title: string;
  description: string;
  // New variables for things shadcn has no variable for. They are defined
  // in `@layer base`, so a value set in your own :root / .dark wins.
  extras: { light: Record<string, string>; dark: Record<string, string> };
  // Tokens with no shadcn counterpart: they keep Kumo's value (override them
  // in your own :root / .dark).
  keepKumo: string[];
  // Kumo token -> value, per mode. A Kumo token that is in neither list
  // (one Kumo added after this file was written) also keeps Kumo's value,
  // and the generator prints a notice.
  tokens: { light: Record<string, string>; dark: Record<string, string> };
  // Like tokens, but only applied inside @supports RELATIVE_COLOR_SUPPORTS.
  supportsTokens: { light: Record<string, string>; dark: Record<string, string> };
}

const status = {
  "--success": kumo("color-kumo-success"),
  "--warning": kumo("color-kumo-warning"),
  "--info": kumo("color-kumo-info"),
};

export const binding: BindingTheme = {
  name: "kumo-binding",
  title: "Kumo binding to your shadcn theme",
  description:
    "Sets Kumo's color tokens from your shadcn CSS variables (--background, --foreground, --primary, ...), so Kumo components follow your theme. Install one theme item: kumo-theme, kumo-cloudflare or kumo-binding.",
  extras: { light: status, dark: status },
  keepKumo: [
    "color-kumo-badge-blue",
    "color-kumo-badge-green",
    "color-kumo-badge-orange",
    "color-kumo-badge-purple",
    "color-kumo-badge-red",
    "color-kumo-badge-teal",
    "color-kumo-shadow-drop",
    "color-kumo-shadow-edge",
    "text-color-kumo-badge-orange-subtle",
    "text-color-kumo-badge-teal-subtle",
    "text-color-kumo-brand",
  ],
  tokens: {
    light: {
      // Surfaces
      "color-kumo-canvas": mix("var(--background)", "var(--foreground)", 1.4),
      "color-kumo-elevated": mix("var(--background)", "var(--foreground)", 2.2),
      "color-kumo-recessed": mix("var(--background)", "var(--foreground)", 4),
      "color-kumo-base": "var(--card)",
      "color-kumo-control": "var(--background)",
      "color-kumo-overlay": mix("var(--popover)", "var(--popover-foreground)", 1.4),
      "color-kumo-contrast": "var(--foreground)",
      // Fills
      "color-kumo-tint": "var(--muted)",
      "color-kumo-fill": mix("var(--secondary)", "var(--secondary-foreground)", 6),
      "color-kumo-fill-hover": "var(--accent)",
      "color-kumo-interact": mix("var(--accent)", "var(--accent-foreground)", 13),
      // Brand
      "color-kumo-brand": "var(--primary)",
      "color-kumo-brand-hover": mix("var(--kumo-brand)", "black", 15),
      // Lines
      "color-kumo-line": "var(--border)",
      "color-kumo-hairline": mix("var(--border)", "var(--background)", 25),
      "color-kumo-focus": "var(--ring)",
      "color-kumo-arrow-edge": "var(--border)",
      "color-kumo-arrow-stroke": "transparent",
      // Status
      "color-kumo-danger": "var(--destructive)",
      "color-kumo-danger-tint": alpha("var(--destructive)", 5),
      "color-kumo-success": "var(--success)",
      "color-kumo-success-tint": alpha("var(--success)", 5),
      "color-kumo-warning": "var(--warning)",
      "color-kumo-warning-tint": alpha("var(--warning)", 7),
      "color-kumo-info": "var(--info)",
      "color-kumo-info-tint": alpha("var(--info)", 7),
      "color-kumo-banner-info": alpha("var(--info)", 12),
      "color-kumo-banner-warning": alpha("var(--warning)", 9),
      "color-kumo-badge-neutral": "var(--muted-foreground)",
      "color-kumo-badge-inverted": "var(--foreground)",
      // Text
      "text-color-kumo-default": mix("var(--foreground)", "var(--background)", 6),
      "text-color-kumo-strong": "var(--foreground)",
      "text-color-kumo-inverse": mix("var(--background)", "var(--foreground)", 3),
      "text-color-kumo-subtle": "var(--muted-foreground)",
      "text-color-kumo-placeholder": mix("var(--muted-foreground)", "var(--background)", 35),
      "text-color-kumo-inactive": mix("var(--muted-foreground)", "var(--background)", 70),
      "text-color-kumo-danger": mix("var(--destructive)", "black", 15),
      "text-color-kumo-success": mix("var(--success)", "black", 28),
      "text-color-kumo-warning": mix("var(--warning)", "black", 20),
      "text-color-kumo-info": mix("var(--info)", "black", 31),
      "text-color-kumo-link": mix("var(--info)", "black", 31),
      "text-color-kumo-badge-neutral-subtle": mix("var(--foreground)", "var(--background)", 15),
      "text-color-kumo-badge-inverted": "var(--background)",
    },
    dark: {
      "color-kumo-canvas": mix("var(--background)", "black", 35),
      "color-kumo-elevated": mix("var(--background)", "black", 20),
      "color-kumo-recessed": "var(--background)",
      "color-kumo-base": mix("var(--card)", "var(--background)", 50),
      "color-kumo-control": "var(--card)",
      "color-kumo-overlay": mix("var(--popover)", "var(--popover-foreground)", 7),
      "color-kumo-contrast": "var(--foreground)",
      "color-kumo-tint": "var(--muted)",
      "color-kumo-fill": "var(--secondary)",
      "color-kumo-fill-hover": "var(--accent)",
      "color-kumo-interact": mix("var(--accent)", "var(--accent-foreground)", 14),
      "color-kumo-brand": "var(--primary)",
      "color-kumo-brand-hover": mix("var(--kumo-brand)", "black", 8),
      "color-kumo-line": mix("var(--border)", "var(--foreground)", 4),
      "color-kumo-hairline": "var(--border)",
      "color-kumo-focus": "var(--ring)",
      "color-kumo-arrow-edge": "transparent",
      "color-kumo-arrow-stroke": "var(--kumo-line)",
      "color-kumo-danger": "var(--destructive)",
      "color-kumo-danger-tint": alpha("var(--destructive)", 6),
      "color-kumo-success": "var(--success)",
      "color-kumo-success-tint": alpha("var(--success)", 7),
      "color-kumo-warning": "var(--warning)",
      "color-kumo-warning-tint": alpha("var(--warning)", 13),
      "color-kumo-info": "var(--info)",
      "color-kumo-info-tint": alpha("var(--info)", 9),
      "color-kumo-banner-info": alpha("var(--info)", 21),
      "color-kumo-banner-warning": alpha("var(--warning)", 40),
      "color-kumo-badge-neutral": mix("var(--muted-foreground)", "var(--background)", 48),
      "color-kumo-badge-inverted": "var(--foreground)",
      "text-color-kumo-default": mix("var(--foreground)", "var(--background)", 2),
      "text-color-kumo-strong": "var(--foreground)",
      "text-color-kumo-inverse": mix("var(--background)", "var(--foreground)", 7),
      "text-color-kumo-subtle": "var(--muted-foreground)",
      "text-color-kumo-placeholder": mix("var(--muted-foreground)", "var(--background)", 25),
      "text-color-kumo-inactive": mix("var(--muted-foreground)", "var(--background)", 45),
      "text-color-kumo-danger": "var(--destructive)",
      "text-color-kumo-success": mix("var(--success)", "white", 55),
      "text-color-kumo-warning": mix("var(--warning)", "white", 28),
      "text-color-kumo-info": mix("var(--info)", "white", 22),
      "text-color-kumo-link": mix("var(--info)", "white", 22),
      "text-color-kumo-badge-neutral-subtle": mix("var(--foreground)", "var(--background)", 8),
      "text-color-kumo-badge-inverted": "var(--background)",
    },
  },
  supportsTokens: {
    light: {
      "color-kumo-brand": capL("var(--primary)", 0.6),
      "color-kumo-danger": capL("var(--destructive)", 0.64),
    },
    dark: {
      "color-kumo-brand": capL("var(--primary)", 0.6),
      "color-kumo-danger": capL("var(--destructive)", 0.6),
    },
  },
};
