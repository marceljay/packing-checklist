import type { TagType } from '../types';

/**
 * Built-in tags offered as quick-add chips. Their `key` (lowercase label) is
 * what catalog items link to, so adding one of these fires suggestions.
 * Users can still add free-text custom tags (no rules attached).
 */
export interface BuiltinTag {
  key: string;
  type: Extract<TagType, 'activity' | 'weather'>;
}

export const BUILTIN_TAGS: BuiltinTag[] = [
  // Activities
  { key: 'beach', type: 'activity' },
  { key: 'swimming', type: 'activity' },
  { key: 'hiking', type: 'activity' },
  { key: 'surfing', type: 'activity' },
  { key: 'skiing', type: 'activity' },
  { key: 'camping', type: 'activity' },
  { key: 'running', type: 'activity' },
  { key: 'cycling', type: 'activity' },
  { key: 'business', type: 'activity' },
  { key: 'formal', type: 'activity' },
  { key: 'photography', type: 'activity' },
  // Weather / conditions
  { key: 'hot', type: 'weather' },
  { key: 'cold', type: 'weather' },
  { key: 'rainy', type: 'weather' },
  { key: 'sunny', type: 'weather' },
  { key: 'windy', type: 'weather' },
];
