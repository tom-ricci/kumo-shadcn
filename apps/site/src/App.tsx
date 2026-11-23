import { ReactNode, useEffect, useState } from "react";
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

const INSTALL: Record<
    string,
    { label: string | ReactNode; code: string; lang: "bash" | "jsonc" }[]
> = {
    url: [
        {
            label: "Add a theme by URL:",
            code: `npx shadcn@latest add ${SITE}/r/kumo-theme.json`,
            lang: "bash",
        },
        {
            label: "Add your components:",
            code: `npx shadcn@latest add ${SITE}/r/button.json`,
            lang: "bash",
        },
    ],
    namespace: [
        {
            label: (
                <>
                    Add the registry to your <code>components.json</code> file:
                </>
            ),
            code: `{\n  "registries": {\n    "@kumo-shadcn": "${SITE}/r/{name}.json"\n  }\n}`,
            lang: "jsonc",
        },
        {
            label: "Then add a theme:",
            code: `npx shadcn@latest add @kumo-shadcn/kumo-theme`,
            lang: "bash",
        },
        {
            label: "And your components:",
            code: `npx shadcn@latest add @kumo-shadcn/button`,
            lang: "bash",
        },
    ],
    github: [
        {
            label: "Add a theme by GitHub repo:",
            code: "npx shadcn@latest add tom-ricci/kumo-shadcn/kumo-theme",
            lang: "bash",
        },
        {
            label: "And your components:",
            code: "npx shadcn@latest add tom-ricci/kumo-shadcn/button",
            lang: "bash",
        },
    ],
};

const THEMES = [
    {
        name: "kumo-theme",
        text: "Kumo's default theme.",
    },
    {
        name: "kumo-cloudflare",
        text: "Cloudflare's products use slightly different colors than Kumo's default colors. This is that.",
    },
    {
        name: "kumo-binding",
        text: "Derives Kumo's design tokens from your ShadCN tokens. This is a slightly lossy conversion but we do our best to make it look good.",
    },
];

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
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
    const [dark, setDark] = useState(() =>
        document.documentElement.classList.contains("dark"),
    );
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
                        <h1 className="text-2xl font-semibold text-kumo-strong">
                            kumo-shadcn
                        </h1>
                    </div>
                    <Button
                        variant="ghost"
                        shape="square"
                        aria-label={
                            dark
                                ? "Switch to light mode"
                                : "Switch to dark mode"
                        }
                        onClick={() => setDark(!dark)}
                    >
                        {dark ? (
                            <Sun className="size-4" />
                        ) : (
                            <Moon className="size-4" />
                        )}
                    </Button>
                </div>
                <Text>
                    A shadcn registry for Kumo, Cloudflare's React component
                    library. Like any shadcn component, each Kumo component is
                    copied into your project as source. No more installing
                    <code>@cloudflare/kumo</code>!
                </Text>
                <Text variant="secondary">
                    Not affiliated with or endorsed by Cloudflare.
                </Text>
                <div className="flex flex-wrap gap-2">
                    <LinkButton
                        href={KUMO_DOCS}
                        external
                        variant="primary"
                        icon={<BookOpen className="size-4" />}
                    >
                        Browse Kumo's components
                    </LinkButton>
                    <LinkButton
                        href={REPO}
                        external
                        variant="secondary"
                        icon={<GitBranch className="size-4" />}
                    >
                        GitHub repository
                    </LinkButton>
                </div>
            </header>

            <Section title="Install">
                <Text>
                    Start from a shadcn project with CLI version 4.23 or later,
                    choose a theme, and add your components.
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
                    <div key={step.code} className="grid gap-2">
                        <Text>{step.label}</Text>
                        <CodeBlock lang={step.lang} code={step.code} />
                    </div>
                ))}
                <hr className="border-kumo-fill" />
                <Text>Finally, import your components: </Text>
                <CodeBlock
                    lang={"tsx"}
                    code={`import { Button } from "@/components/ui/button/button"`}
                />
                <Text>
                    You can find the full list of components in{" "}
                    <code>registry.json</code>:
                </Text>
                <ClipboardText text={`${SITE}/r/registry.json`} />
            </Section>

            <Section title="Theme">
                <Text>
                    Kumo is not directly ShadCN compatible. It uses its own
                    design tokens that don't map perfectly with ShadCN. So, this
                    registry provides a few themes to choose from. Each theme
                    pulls in <code>kumo-base</code> and makes modifications on
                    top of it. <code>kumo-base</code> does its best to avoid
                    messing with <em>your</em> CSS, so we prepend conflicting
                    classnames with <code>kumo-</code>.
                </Text>
                <ul className="grid gap-3">
                    {THEMES.map((t) => (
                        <li key={t.name} className="grid gap-1">
                            <Text bold>{t.name}</Text>
                            <Text variant="secondary">{t.text}</Text>
                        </li>
                    ))}
                </ul>
            </Section>

            <Section title="Icons">
                <Text>
                    Kumo uses Phosphor icons by default. ShadCN allows users to
                    choose from multiple icon libraries, so we've tastefully
                    mapped Lucide, Tabler, Hugeicons, and Remixicon icons to
                    each Phosphor icon Kumo uses. <code>kumo-shadcn</code> will
                    use whatever icon library you have set in{" "}
                    <code>components.json</code>.
                </Text>
            </Section>

            <Section title="Caveats">
                <Banner
                    variant="alert"
                    title="Vite's strict TypeScript settings"
                    description="Kumo's code is copied as it is. Vite's default tsconfig and linter rules may throw errors for certain components."
                />
                <Banner
                    variant="alert"
                    title="React Server Components"
                    description={`Kumo doesn't prepend all components with "use client";, so you might have to wrap Kumo components with client-side components.`}
                />
                <Banner
                    variant="error"
                    title="Tailwind prefix is not supported"
                    description="Kumo keeps most of its classes in variant objects that the shadcn CLI's prefix transform doesn't reach, so those classes produce no styles."
                />
                <Banner
                    title="kumo-binding requires CSS variables"
                    description={
                        <>
                            The kumo-binding theme depends on CSS variables, so
                            tailwind.cssVariables must be true in{" "}
                            <code>components.json</code> if you want this theme
                            to work.
                        </>
                    }
                />
            </Section>

            <Section title="Updates">
                <Text>
                    We intend to keep <code>kumo-shadcn</code> up-to-date with
                    upstream Kumo. CI rebuilds this registry each day. If there
                    are any new Kumo components, they are automatically ported
                    and go through a series of tests to make sure they work
                    properly. If this fails, they get ported manually.
                </Text>
            </Section>

            <Section title="License">
                <Text>
                    The registry's own code is MIT licensed. The component files
                    are copied from Kumo, which is also MIT licensed, copyright
                    Cloudflare, Inc.; each file ships with Cloudflare's original
                    license. "Cloudflare" and "Kumo" are Cloudflare's
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
