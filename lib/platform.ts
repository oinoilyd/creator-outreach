import type { PlatformConfig } from './types'

export const PLATFORM_CONFIGS: PlatformConfig[] = [
  { id: 'youtube',   label: 'YouTube',    emoji: '▶️',  activeBg: 'bg-red-700 border-red-600 text-white',      condition: null,            column: null,        chipLabel: '',                    chipWeight: 0  },
  { id: 'instagram', label: 'Instagram',  emoji: '📸',  activeBg: 'bg-pink-700 border-pink-500 text-white',    condition: 'has_instagram', column: 'instagram', chipLabel: 'Active on Instagram', chipWeight: 20 },
  { id: 'tiktok',    label: 'TikTok',     emoji: '🎵',  activeBg: 'bg-cyan-700 border-cyan-500 text-white',    condition: 'has_tiktok',    column: 'tiktok',    chipLabel: 'Active on TikTok',    chipWeight: 20 },
  { id: 'twitter',   label: 'X',          emoji: '🐦',  activeBg: 'bg-gray-800 border-gray-500 text-white',    condition: 'has_twitter',   column: 'twitter',   chipLabel: 'Active on X',         chipWeight: 20 },
  { id: 'linkedin',  label: 'LinkedIn',   emoji: '💼',  activeBg: 'bg-blue-800 border-blue-600 text-white',    condition: 'has_linkedin',  column: 'linkedin',  chipLabel: 'Has LinkedIn',        chipWeight: 20 },
]

export const PLATFORM_LOCK_ID = '__platform__'
