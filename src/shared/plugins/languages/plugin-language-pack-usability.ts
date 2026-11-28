/** Packs below this share of translated strings stay installed but can't be chosen as the UI
 *  language, since switching to one would leave most of Orca in English. */
export const PLUGIN_LANGUAGE_PACK_MIN_COVERAGE = 80

export function isUsablePluginLanguagePack(pack: { coverage: number }): boolean {
  return pack.coverage >= PLUGIN_LANGUAGE_PACK_MIN_COVERAGE
}
