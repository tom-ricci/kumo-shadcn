// Icon mapping for the kumo-icons shim (registry/kumo/lib/kumo/icons.tsx).
//
// Kumo imports Phosphor icons. The shim exports the same names, and each one
// renders shadcn's IconPlaceholder, so the shadcn CLI swaps in the icon library
// set in the user's components.json (iconLibrary) at install time.
//
// Keys are Phosphor names without the "Icon" suffix: Kumo imports both `X` and
// `XIcon`, and both map to the entry `X`. Values are export names in each
// library's package. scripts/check-icons.ts checks every name against the real
// packages. The generator fails with "unmapped icon: <name>" when Kumo imports
// an icon that is missing here.
//
// Packages: lucide-react, @tabler/icons-react, @hugeicons/core-free-icons
// (rendered through @hugeicons/react), @phosphor-icons/react, @remixicon/react.

export type IconLibrary = "lucide" | "tabler" | "hugeicons" | "phosphor" | "remixicon";
export const ICON_LIBRARIES: IconLibrary[] = ["lucide", "tabler", "hugeicons", "phosphor", "remixicon"];

type Entry = Record<Exclude<IconLibrary, "phosphor">, string>;

// Phosphor's own name is always `${key}Icon` (Phosphor 2.1 exports both forms;
// the suffixed one avoids clashing with the shim's exports).
export const ICONS: Record<string, Entry> = {
  ArrowRight: { lucide: "ArrowRightIcon", tabler: "IconArrowRight", hugeicons: "ArrowRight02Icon", remixicon: "RiArrowRightLine" },
  ArrowSquareOut: { lucide: "ExternalLinkIcon", tabler: "IconExternalLink", hugeicons: "LinkSquare02Icon", remixicon: "RiExternalLinkLine" },
  ArrowsClockwise: { lucide: "RefreshCwIcon", tabler: "IconRefresh", hugeicons: "RefreshIcon", remixicon: "RiRefreshLine" },
  CaretDoubleLeft: { lucide: "ChevronsLeftIcon", tabler: "IconChevronsLeft", hugeicons: "ArrowLeftDoubleIcon", remixicon: "RiArrowLeftDoubleLine" },
  CaretDoubleRight: { lucide: "ChevronsRightIcon", tabler: "IconChevronsRight", hugeicons: "ArrowRightDoubleIcon", remixicon: "RiArrowRightDoubleLine" },
  CaretDown: { lucide: "ChevronDownIcon", tabler: "IconChevronDown", hugeicons: "ArrowDown01Icon", remixicon: "RiArrowDownSLine" },
  CaretLeft: { lucide: "ChevronLeftIcon", tabler: "IconChevronLeft", hugeicons: "ArrowLeft01Icon", remixicon: "RiArrowLeftSLine" },
  CaretRight: { lucide: "ChevronRightIcon", tabler: "IconChevronRight", hugeicons: "ArrowRight01Icon", remixicon: "RiArrowRightSLine" },
  CaretUp: { lucide: "ChevronUpIcon", tabler: "IconChevronUp", hugeicons: "ArrowUp01Icon", remixicon: "RiArrowUpSLine" },
  CaretUpDown: { lucide: "ChevronsUpDownIcon", tabler: "IconSelector", hugeicons: "UnfoldMoreIcon", remixicon: "RiExpandUpDownLine" },
  Check: { lucide: "CheckIcon", tabler: "IconCheck", hugeicons: "Tick02Icon", remixicon: "RiCheckLine" },
  CheckCircle: { lucide: "CircleCheckIcon", tabler: "IconCircleCheck", hugeicons: "CheckmarkCircle02Icon", remixicon: "RiCheckboxCircleLine" },
  Copy: { lucide: "CopyIcon", tabler: "IconCopy", hugeicons: "Copy01Icon", remixicon: "RiFileCopyLine" },
  CopySimple: { lucide: "CopyIcon", tabler: "IconCopy", hugeicons: "Copy01Icon", remixicon: "RiFileCopyLine" },
  Eye: { lucide: "EyeIcon", tabler: "IconEye", hugeicons: "ViewIcon", remixicon: "RiEyeLine" },
  EyeSlash: { lucide: "EyeOffIcon", tabler: "IconEyeOff", hugeicons: "ViewOffIcon", remixicon: "RiEyeOffLine" },
  GlobeHemisphereWest: { lucide: "EarthIcon", tabler: "IconWorld", hugeicons: "Globe02Icon", remixicon: "RiEarthLine" },
  Info: { lucide: "InfoIcon", tabler: "IconInfoCircle", hugeicons: "InformationCircleIcon", remixicon: "RiInformationLine" },
  MagnifyingGlass: { lucide: "SearchIcon", tabler: "IconSearch", hugeicons: "Search01Icon", remixicon: "RiSearchLine" },
  Minus: { lucide: "MinusIcon", tabler: "IconMinus", hugeicons: "MinusSignIcon", remixicon: "RiSubtractLine" },
  Warning: { lucide: "TriangleAlertIcon", tabler: "IconAlertTriangle", hugeicons: "Alert02Icon", remixicon: "RiAlertLine" },
  WarningCircle: { lucide: "CircleAlertIcon", tabler: "IconAlertCircle", hugeicons: "AlertCircleIcon", remixicon: "RiErrorWarningLine" },
  WarningOctagon: { lucide: "OctagonAlertIcon", tabler: "IconAlertOctagon", hugeicons: "OctagonAlertIcon", remixicon: "RiSpam2Line" },
  X: { lucide: "XIcon", tabler: "IconX", hugeicons: "Cancel01Icon", remixicon: "RiCloseLine" },
};

export function iconNames(key: string): Record<IconLibrary, string> | undefined {
  const entry = ICONS[key];
  return entry && { ...entry, phosphor: `${key}Icon` };
}

// Non-icon names Kumo imports from @phosphor-icons/react that the shim
// provides itself.
export const SHIM_EXTRAS = new Set(["Icon", "IconProps", "IconWeight", "IconContext"]);
