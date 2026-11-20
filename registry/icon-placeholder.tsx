// Stand-in for shadcn's IconPlaceholder, used only to type-check this
// repository. The shadcn CLI removes the import of it and replaces each
// <IconPlaceholder /> with an icon from the user's iconLibrary.
import type * as React from "react";

type Libraries = "lucide" | "tabler" | "hugeicons" | "phosphor" | "remixicon";

export function IconPlaceholder(
  _props: Record<Libraries, string> & Omit<React.SVGProps<SVGSVGElement>, "ref" | "children"> & { size?: number | string },
): React.ReactElement | null {
  return null;
}
