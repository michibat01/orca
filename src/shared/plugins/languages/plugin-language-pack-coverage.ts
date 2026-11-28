import { isProtectedPluginTranslationPath } from '../artifacts/plugin-language-pack-artifact'
export {
  PLUGIN_LANGUAGE_PACK_MIN_COVERAGE,
  isUsablePluginLanguagePack
} from './plugin-language-pack-usability'

function collectStringPaths(
  catalog: Record<string, unknown>,
  prefix: string,
  into: Set<string>
): Set<string> {
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      if (value.length > 0 && !isProtectedPluginTranslationPath(path)) {
        into.add(path)
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      collectStringPaths(Object.fromEntries(Object.entries(value)), path, into)
    }
  }
  return into
}

/** Dotted paths of every non-empty string a language pack may translate. */
export function translatableCatalogPaths(catalog: Record<string, unknown>): Set<string> {
  return collectStringPaths(catalog, '', new Set())
}

/** Whole percent of `english` paths the pack translates; keys English lacks don't count. */
export function pluginLanguagePackCoverage(
  catalog: Record<string, unknown>,
  english: ReadonlySet<string>
): number {
  if (english.size === 0) {
    return 0
  }
  let translated = 0
  for (const path of translatableCatalogPaths(catalog)) {
    if (english.has(path)) {
      translated += 1
    }
  }
  return Math.floor((translated / english.size) * 100)
}
