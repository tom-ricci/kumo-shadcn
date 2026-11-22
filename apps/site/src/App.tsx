import { useEffect, useState } from "react";
import { BookOpen, GitBranch, Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge/badge";
import { Banner } from "@/components/ui/banner/banner";
import { LinkButton, Button } from "@/components/ui/button/button";
import { ClipboardText } from "@/components/ui/clipboard-text/clipboard-text";
import { CodeBlock } from "@/components/ui/code/code";
import { LayerCard } from "@/components/ui/layer-card/layer-card";
import { Link } from "@/components/ui/link/link";
import { Tabs } from "@/components/ui/tabs/tabs";
import { Text } from "@/components/ui/text/text";

const SITE = "https://kumo-shadcn.thomasricci.dev";
const REPO = "https://github.com/tom-ricci/kumo-shadcn";
const KUMO_DOCS = "https://kumo-ui.com";

const INSTALL: Record<string, { label: string; code: string; lang: "bash" | "jsonc" }[]> = {
  url: [
    {
      label: "Add a theme and a component by URL:",
      code: `npx shadcn@latest add ${SITE}/r/kumo-theme.json\nnpx shadcn@latest add ${SITE}/r/button.json`,
      lang: "bash",
    },
  ],
  namespace: [
    {
      label: "Give the registry a namespace in components.json:",
      code: `{\n  "registries": {\n    "@kumo-shadcn": "${SITE}/r/{name}.json"\n  }\n}`,
      lang: "jsonc",
    },
    { label: "Then add items by name:", code: "npx shadcn@latest add @kumo-shadcn/kumo-theme @kumo-shadcn/button", lang: "bash" },
  ],
  github: [
    {
      label: "Straight from the GitHub repository, with no hosting involved:",
      code: "npx shadcn@latest add tom-ricci/kumo-shadcn/kumo-theme tom-ricci/kumo-shadcn/button",
      lang: "bash",
    },
  ],
};

const THEMES = [
  {
    name: "kumo-theme",
    text: "Kumo's own colors and type scale, as Kumo ships them, including Kumo's fedramp theme.",
  },
  {
    name: "kumo-cloudflare",
    text: "Kumo's colors plus where the Cloudflare dashboard is heading: one highlight shade for every hover and selected state, and a sidebar on the page background.",
  },
  {
    name: "kumo-binding",
    text: "Kumo's colors taken from your shadcn variables (--background, --primary, ...), so Kumo components match the rest of your app.",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <LayerCard>
      <LayerCard.Secondary>{title}</LayerCard.Secondary>
      <LayerCard.Primary>
        <div className="grid gap-4 text-kumo-default">{children}</div>
      </LayerCard.Primary>
    </LayerCard>
  );
}

function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("kumo-shadcn-mode", dark ? "dark" : "light");
    } catch {
      // Private mode or blocked storage: the toggle still works for this visit.
    }
  }, [dark]);
  return [dark, setDark] as const;
}

export function App() {
  const [dark, setDark] = useDarkMode();
  const [method, setMethod] = useState("url");

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-10 sm:px-6">
      <header className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-kumo-strong">kumo-shadcn</h1>
            <Badge variant="neutral">Unofficial</Badge>
          </div>
          <Button
            variant="ghost"
            shape="square"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
        <Text>
          A shadcn registry for Kumo, Cloudflare's React component library. Like any shadcn component, each Kumo component
          is copied into your project as source, where your <code>components.json</code> says, with your icon library.
          There is no <code>@cloudflare/kumo</code> package to install.
        </Text>
        <Text variant="secondary">This page is built with kumo-shadcn itself. Not affiliated with or endorsed by Cloudflare.</Text>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={KUMO_DOCS} external variant="primary" icon={<BookOpen className="size-4" />}>
            Browse Kumo's components
          </LinkButton>
          <LinkButton href={REPO} external variant="secondary" icon={<GitBranch className="size-4" />}>
            GitHub repository
          </LinkButton>
        </div>
      </header>

      <Section title="Install">
        <Text>
          Start from a project set up with <code>npx shadcn@latest init</code> (Tailwind CSS v4, React 18 or 19, shadcn CLI
          4.23 or later). Add exactly one theme item, then the components you want. Each component brings the components,
          helpers and icons it needs.
        </Text>
        <Tabs
          variant="segmented"
          tabs={[
            { value: "url", label: "By URL" },
            { value: "namespace", label: "@kumo-shadcn namespace" },
            { value: "github", label: "GitHub" },
          ]}
          selectedValue={method}
          onValueChange={setMethod}
        />
        {INSTALL[method].map((step) => (
          <div key={step.label} className="grid gap-2">
            <Text variant="secondary">{step.label}</Text>
            <CodeBlock lang={step.lang} code={step.code} />
          </div>
        ))}
        <Text>
          Then import it from the folder the CLI wrote, for example{" "}
          <code>{'import { Button } from "@/components/ui/button/button"'}</code>. The full list of items is in the
          registry index:
        </Text>
        <ClipboardText text={`${SITE}/r/registry.json`} />
      </Section>

      <Section title="Pick one theme item">
        <Text>
          The components install <code>kumo-base</code> on their own. The colors come from one theme item. Install exactly
          one:
        </Text>
        <ul className="grid gap-3">
          {THEMES.map((t) => (
            <li key={t.name} className="grid gap-1">
              <Text bold>{t.name}</Text>
              <Text variant="secondary">{t.text}</Text>
            </li>
          ))}
        </ul>
        <Text variant="secondary">
          The items only write Kumo's own names (<code>--kumo-*</code> variables, <code>kumo-</code> classes and
          keyframes), so your own <code>text-sm</code>, transitions and classes look as they did. Dark mode follows
          shadcn's <code>.dark</code> class. To switch themes later, remove the old theme's rules from{" "}
          <code>@layer base</code> in your CSS file, then add the new item.
        </Text>
      </Section>

      <Section title="Icons">
        <Text>
          Kumo draws its icons with Phosphor. Here they come from the icon library set as <code>iconLibrary</code> in your{" "}
          <code>components.json</code>: lucide, tabler, hugeicons, phosphor or remixicon. <code>shadcn init</code> installs
          that library's package; if you change libraries later, install its package too.
        </Text>
      </Section>

      <Section title="Good to know">
        <Banner
          variant="alert"
          title="Vite's strict TypeScript settings"
          description="Kumo's code is copied as it is. With every item added, a stock Vite app reports 15 tsc errors and vite build fails. Set erasableSyntaxOnly, noUnusedParameters and verbatimModuleSyntax to false in tsconfig.app.json and both pass."
        />
        <Banner
          variant="alert"
          title="Next.js: use Kumo from a client file"
          description={'Kumo\'s source marks almost nothing with "use client". Render Kumo components from your own "use client" files; rendering them directly in a Server Component fails next build.'}
        />
        <Banner
          variant="error"
          title="Tailwind prefix is not supported"
          description="Kumo keeps most of its classes in variant objects that the shadcn CLI's prefix transform doesn't reach, so those classes produce no styles."
        />
        <Banner
          title="kumo-binding needs CSS variables"
          description="It reads your shadcn CSS variables, so tailwind.cssVariables must be true in components.json. kumo-theme and kumo-cloudflare work either way."
        />
        <Banner
          title="kumo-theme changes the type scale app-wide"
          description="kumo-theme and kumo-cloudflare set Kumo's text sizes (12, 13, 14 and 16px) for the whole app. kumo-binding leaves yours alone."
        />
      </Section>

      <Section title="Updates">
        <Text>
          A workflow rebuilds the registry every day from the latest Kumo release. It installs every item into fresh Vite and
          Next.js apps with the real shadcn CLI, and publishes only if they all type-check and build. Like any shadcn
          component, your copy doesn't change by itself: run <code>shadcn add &lt;item&gt; --overwrite</code> to take an
          update, and check the diff.
        </Text>
      </Section>

      <Section title="License">
        <Text>
          The registry's own code is MIT licensed. The component files are copied from Kumo, which is also MIT licensed,
          copyright Cloudflare, Inc.; each file carries Kumo's license notice. "Cloudflare" and "Kumo" are Cloudflare's
          trademarks.
        </Text>
      </Section>

      <footer className="flex flex-wrap gap-x-4 gap-y-1 pb-6 text-(length:--kumo-font-size-sm)/[var(--tw-leading,var(--kumo-line-height-sm))]">
        <Link href={KUMO_DOCS}>Kumo docs</Link>
        <Link href={REPO}>GitHub</Link>
        <Link href={`${SITE}/r/registry.json`}>Registry index</Link>
      </footer>
    </div>
  );
}
