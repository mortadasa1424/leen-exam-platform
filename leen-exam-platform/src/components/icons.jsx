// Curated re-export of the lucide-react icons used across the platform UI, so
// every call site imports from one place instead of picking icons ad hoc.
export {
  Home,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Clock,
  Flag,
  LayoutGrid,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  BarChart3,
  RotateCcw,
  Calculator,
  BookOpen,
  Eye,
  Pause,
} from "lucide-react";

import {
  Calculator as CalculatorIcon,
  BookOpen as BookOpenIcon,
  FlaskConical as FlaskConicalIcon,
  Atom as AtomIcon,
  Languages as LanguagesIcon,
  PenTool as PenToolIcon,
  Globe as GlobeIcon,
  Brain as BrainIcon,
  Ruler as RulerIcon,
  GraduationCap as GraduationCapIcon,
  Layers as LayersIcon,
  FileText as FileTextIcon,
  ScrollText as ScrollTextIcon,
  Landmark as LandmarkIcon,
  Microscope as MicroscopeIcon,
  LayoutGrid as LayoutGridIcon,
} from "lucide-react";

// Reusable registry resolving an exam section's `icon` config string (e.g.
// "calculator") to its lucide-react component, so exam.config.js can stay
// plain data instead of importing JSX. Extend this map (not per-exam code)
// when a new exam needs an icon that isn't here yet.
export const SECTION_ICONS = {
  calculator: CalculatorIcon,
  bookOpen: BookOpenIcon,
  flaskConical: FlaskConicalIcon,
  atom: AtomIcon,
  languages: LanguagesIcon,
  penTool: PenToolIcon,
  globe: GlobeIcon,
  brain: BrainIcon,
  ruler: RulerIcon,
  graduationCap: GraduationCapIcon,
  layers: LayersIcon,
  fileText: FileTextIcon,
  scrollText: ScrollTextIcon,
  landmark: LandmarkIcon,
  microscope: MicroscopeIcon,
};

// Neutral default when a section's `icon` key is missing or unrecognized —
// deliberately not Calculator/BookOpen (both imply a specific subject), so
// an exam that hasn't picked an icon yet doesn't look math- or
// reading-themed by accident.
const DEFAULT_SECTION_ICON = LayoutGridIcon;

// Single place both SectionSelect.jsx and Home.jsx call to resolve a
// section's icon, so the fallback rule lives in one place, not duplicated
// at each call site.
export function getSectionIcon(iconKey) {
  return SECTION_ICONS[iconKey] || DEFAULT_SECTION_ICON;
}
