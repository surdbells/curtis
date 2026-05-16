import {
  AlertCircle,
  ArrowRight,
  BatteryCharging,
  Battery,
  Building2,
  Camera,
  CheckCircle2,
  CheckCircle,
  Circle,
  ChevronRight,
  XCircle,
  X,
  CloudOff,
  UploadCloud,
  Copy,
  FingerprintPattern,
  Info,
  List,
  MapPin,
  LogOut,
  Map,
  Moon,
  Navigation,
  Bell,
  Smartphone,
  Play,
  QrCode,
  RefreshCw,
  RotateCw,
  Send,
  Settings,
  Sun,
  Trash2,
  AlertTriangle,
  // Phase 9 additions for dashboard tiles + other surfaces
  ArrowLeftRight,
  Cog,
  Edit3,
  Barcode,
  FileText,
  Receipt,
  Truck,
  Shield,
  Eye,
  EyeOff,
  ChevronLeft,
  User,
  Lock,
  Search,
  Plus,
  Minus,
  Activity,
  Power,
  MoreHorizontal,
  type LucideIconData,
} from 'lucide-angular';

/**
 * Icon registry — single source of truth for every icon used in the app.
 *
 * Names mirror the Ionicons taxonomy used in earlier phases for minimal
 * markup churn during migration. Adding a new icon requires:
 *   1. Import the Lucide icon at the top of this file
 *   2. Add the entry to ICON_REGISTRY
 *
 * Outline vs filled: Lucide is an outline-style set; all entries map to
 * outline variants. The historic '-outline' suffix in names is kept for
 * compatibility with existing templates and for semantic clarity.
 */
export const ICON_REGISTRY = {
  // Status / state
  'alert-circle': AlertCircle,
  'alert-circle-outline': AlertCircle,
  'checkmark-circle-outline': CheckCircle2,
  'checkmark-done-circle-outline': CheckCircle2,
  'close-circle-outline': XCircle,
  'close-outline': X,
  'information-circle-outline': Info,
  'warning': AlertTriangle,
  'warning-outline': AlertTriangle,

  // Navigation / structure
  'arrow-forward-outline': ArrowRight,
  'chevron-forward-outline': ChevronRight,
  'list-outline': List,
  'map-outline': Map,
  'navigate-circle-outline': Navigation,
  'location-outline': MapPin,
  'phone-portrait-outline': Smartphone,

  // Auth / identity
  'finger-print-outline': FingerprintPattern,
  'log-out-outline': LogOut,

  // Actions
  'camera-outline': Camera,
  'copy-outline': Copy,
  'play-outline': Play,
  'qr-code-outline': QrCode,
  'refresh-outline': RefreshCw,
  'reload-outline': RotateCw,
  'send': Send,
  'settings-outline': Settings,
  'trash-outline': Trash2,
  'trash-bin-outline': Trash2,

  // Connectivity / sync
  'cloud-offline-outline': CloudOff,
  'cloud-upload-outline': UploadCloud,
  'notifications-outline': Bell,

  // Theme
  'moon-outline': Moon,
  'sunny-outline': Sun,

  // Domain
  'business-outline': Building2,
  'battery-charging-outline': BatteryCharging,
  'battery-half-outline': Battery,

  // Phase 9 additions — dashboard tile icons + auth/utility
  'swap-horizontal-outline': ArrowLeftRight,
  'cog-outline':              Cog,
  'create-outline':           Edit3,
  'barcode-outline':          Barcode,
  'document-text-outline':    FileText,
  'receipt-outline':          Receipt,
  'car-outline':              Truck,
  'shield-checkmark-outline': Shield,
  'eye-outline':              Eye,
  'eye-off-outline':          EyeOff,
  'chevron-back-outline':     ChevronLeft,
  'person-outline':           User,
  'lock-closed-outline':      Lock,
  'search-outline':           Search,
  'add-outline':              Plus,
  'remove-outline':           Minus,
  'pulse-outline':            Activity,
  'power-outline':            Power,
  'ellipsis-horizontal':      MoreHorizontal,

  // Filled / state checklist icons (used in incident report requirements list)
  'checkmark-circle':         CheckCircle,
  'ellipse-outline':          Circle,
} as const satisfies Record<string, LucideIconData>;

/** All valid icon names — compile-time enforcement everywhere a name is used. */
export type CurtisIconName = keyof typeof ICON_REGISTRY;

/** Quick lookup. Returns undefined for unknown names so the component can render nothing rather than throw. */
export function resolveIcon(name: string): LucideIconData | undefined {
  return (ICON_REGISTRY as Record<string, LucideIconData>)[name];
}
