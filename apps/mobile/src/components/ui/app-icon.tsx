/** One functional vector family. Labels belong to the containing control. */
import type { LucideProps } from 'lucide-react-native';
import ArrowDownToLine from 'lucide-react-native/icons/arrow-down-to-line';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import AudioLines from 'lucide-react-native/icons/audio-lines';
import Award from 'lucide-react-native/icons/award';
import BarChart3 from 'lucide-react-native/icons/chart-column';
import BookOpen from 'lucide-react-native/icons/book-open';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleHelp from 'lucide-react-native/icons/circle-question-mark';
import Clock3 from 'lucide-react-native/icons/clock-3';
import Coins from 'lucide-react-native/icons/coins';
import Download from 'lucide-react-native/icons/download';
import Flame from 'lucide-react-native/icons/flame';
import Gamepad2 from 'lucide-react-native/icons/gamepad-2';
import Heart from 'lucide-react-native/icons/heart';
import House from 'lucide-react-native/icons/house';
import Info from 'lucide-react-native/icons/info';
import Layers3 from 'lucide-react-native/icons/layers';
import LockKeyhole from 'lucide-react-native/icons/lock-keyhole';
import Moon from 'lucide-react-native/icons/moon';
import Pause from 'lucide-react-native/icons/pause';
import Play from 'lucide-react-native/icons/play';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Search from 'lucide-react-native/icons/search';
import Settings2 from 'lucide-react-native/icons/settings-2';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Star from 'lucide-react-native/icons/star';
import Sun from 'lucide-react-native/icons/sun';
import Target from 'lucide-react-native/icons/target';
import Trash2 from 'lucide-react-native/icons/trash';
import Trophy from 'lucide-react-native/icons/trophy';
import Upload from 'lucide-react-native/icons/upload';
import UserRound from 'lucide-react-native/icons/user-round';
import Volume2 from 'lucide-react-native/icons/volume-2';
import VolumeX from 'lucide-react-native/icons/volume-x';
import X from 'lucide-react-native/icons/x';

import { useTheme } from '@/hooks/use-theme';
import type { ThemeColor } from '@/theme/tokens';

// Public per-icon exports bound Metro's graph without relying on barrel
// tree-shaking; importing the root value barrel discovers every Lucide icon.
const ICONS = {
  back: ArrowLeft, next: ArrowRight, external: ArrowUpRight, check: Check,
  close: X, chevron: ChevronRight, expand: ChevronDown, home: House,
  games: Gamepad2, progress: BarChart3, profile: UserRound, settings: Settings2,
  filter: SlidersHorizontal, search: Search, favorite: Heart, star: Star,
  play: Play, pause: Pause, retry: RefreshCw, time: Clock3, streak: Flame,
  coins: Coins, award: Award, trophy: Trophy, sparkles: Sparkles, target: Target,
  book: BookOpen, layers: Layers3, help: CircleHelp, info: Info, moon: Moon,
  sun: Sun, sound: Volume2, muted: VolumeX, audio: AudioLines, shield: ShieldCheck,
  download: Download, save: ArrowDownToLine, upload: Upload, delete: Trash2,
  lock: LockKeyhole,
} as const;

export type AppIconName = keyof typeof ICONS;
export interface AppIconProps extends Omit<LucideProps, 'color' | 'size'> {
  name: AppIconName;
  size?: number;
  color?: string;
  tone?: ThemeColor;
}

export function AppIcon({ name, size = 20, color, tone = 'textSecondary', ...rest }: AppIconProps) {
  const theme = useTheme();
  const Icon = ICONS[name];
  return (
    <Icon
      {...rest}
      size={size}
      color={color ?? theme[tone]}
      strokeWidth={2}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    />
  );
}
