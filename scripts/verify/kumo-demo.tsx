"use client";

// Demo page for scripts/verify.sh: renders a sample of Kumo components and
// imports every installed item (kumo-all.ts, written by the script), so the
// type check and the production build cover all of them.
// ?dark on the URL switches to dark mode with shadcn's .dark class.
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/index";
import { Banner } from "@/components/ui/banner/index";
import { Button } from "@/components/ui/button/index";
import { Checkbox } from "@/components/ui/checkbox/index";
import { ClipboardText } from "@/components/ui/clipboard-text/index";
import { Input } from "@/components/ui/input/index";
import { LayerCard } from "@/components/ui/layer-card/index";
import { Meter } from "@/components/ui/meter/index";
import { Pagination } from "@/components/ui/pagination/index";
import { Switch } from "@/components/ui/switch/index";
import { Tabs } from "@/components/ui/tabs/index";
import { Text } from "@/components/ui/text/index";
import { Info, WarningIcon } from "@/lib/kumo/icons";
import { kumoModules } from "./kumo-all";

export function KumoDemo() {
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [page, setPage] = useState(2);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", new URLSearchParams(window.location.search).has("dark"));
  }, []);
  return (
    <div className="min-h-screen bg-kumo-canvas p-8 text-kumo-default" data-kumo-modules={kumoModules.length}>
      <div className="mx-auto grid max-w-3xl gap-6">
        <Text variant="heading">Kumo via shadcn</Text>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="secondary" icon={WarningIcon}>
            With icon
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">Primary</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="error">Error</Badge>
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="orange">Orange</Badge>
        </div>
        <Banner icon={<Info weight="fill" />} title="Update available" description="A new version is ready to install." />
        <LayerCard>
          <LayerCard.Secondary>Settings</LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="grid gap-4">
              <Input label="Email" placeholder="you@example.com" description="We'll never share your email" />
              <Switch label="Notifications" checked={on} onCheckedChange={setOn} />
              <Checkbox label="Accept terms" checked={checked} onCheckedChange={setChecked} />
              <Meter label="Storage used" value={65} />
            </div>
          </LayerCard.Primary>
        </LayerCard>
        <Tabs
          variant="segmented"
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "metrics", label: "Metrics" },
            { value: "logs", label: "Logs" },
          ]}
          selectedValue="overview"
        />
        <div className="flex flex-wrap items-center gap-4">
          <ClipboardText text="0c239dd2" />
          <Pagination page={page} setPage={setPage} perPage={10} totalCount={100} />
        </div>
      </div>
    </div>
  );
}
