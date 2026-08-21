import { loadContentPack } from './content-validation';

export const SCORING_VERSION = '1.1.0';

export const CONTENT_PACK_ID: string = loadContentPack().packId;
export const CONTENT_PACK_VERSION: string = loadContentPack().packVersion;

export function versionToNumber(version: string | null): number {
  if (version === null) return 0;
  const parts = (version ?? '').split('.');
  const ma = Number(parts[0] ?? 0);
  const mi = Number(parts[1] ?? 0);
  const pa = Number(parts[2] ?? 0);
  return ma * 1_000_000 + mi * 1_000 + pa;
}
