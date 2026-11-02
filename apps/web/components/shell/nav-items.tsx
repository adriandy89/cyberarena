import { MapIcon, Swords, Trophy, type LucideIcon } from '../icon';

export interface NavItem {
  href: string;
  /** Key in the `Nav` messages namespace. */
  labelKey: 'paths' | 'hacktivities' | 'leaderboard';
  icon: LucideIcon;
  also?: string[];
}

/** Primary navigation, shared by the desktop header and the mobile drawer. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/paths', labelKey: 'paths', icon: MapIcon, also: ['/rooms', '/certificate'] },
  { href: '/hacktivities', labelKey: 'hacktivities', icon: Swords },
  { href: '/leaderboard', labelKey: 'leaderboard', icon: Trophy },
];
