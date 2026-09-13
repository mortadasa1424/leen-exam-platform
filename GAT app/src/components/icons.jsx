// Curated re-export of the lucide-react icons used across the GAT UI, so
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

import { Calculator as CalculatorIcon, BookOpen as BookOpenIcon } from "lucide-react";

// Resolves an exam section's `icon` config string (e.g. "calculator") to its
// component, so exam.config.js can stay plain data instead of importing JSX.
export const SECTION_ICONS = {
  calculator: CalculatorIcon,
  bookOpen: BookOpenIcon,
};
