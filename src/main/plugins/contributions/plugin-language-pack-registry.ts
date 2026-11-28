import type { PluginLanguagePackRegistration } from '../../../shared/plugins/artifacts/plugin-language-pack-artifact'
import type { EnglishSourceLookup } from '../../../shared/plugins/languages/plugin-translation-string-policy'
import type { PluginManifest } from '../../../shared/plugins/manifest/plugin-manifest'
import { PLUGIN_LANGUAGE_PACK_MAX_BYTES } from '../artifacts/plugin-artifact-validation'
import { readContainedPluginArtifactText } from '../artifacts/plugin-contained-artifact'
import { PluginArtifactPackRegistry } from './plugin-artifact-pack-registry'
import type { PluginContentVerifier } from '../artifacts/plugin-content-integrity'

type LanguagePackContribution = PluginManifest['contributes']['languagePacks'][number]

type EnglishSource = { translatablePaths: ReadonlySet<string>; lookup: EnglishSourceLookup }

let englishSource: Promise<EnglishSource> | null = null

// Why lazy: the English catalog (~1 MB) and protected-copy key table (~100 KB) only matter once a language pack loads.
function loadEnglishSource(): Promise<EnglishSource> {
  if (!englishSource) {
    const pending = Promise.all([
      import('../../../renderer/src/i18n/locales/en.json'),
      import('../../../shared/plugins/languages/plugin-language-pack-coverage'),
      import('../../../shared/plugins/languages/plugin-translation-string-policy')
    ])
      .then(([locale, { translatableCatalogPaths }, { englishSourceLookup }]) => ({
        translatablePaths: translatableCatalogPaths(locale.default),
        lookup: englishSourceLookup(locale.default)
      }))
      .catch((error: unknown) => {
        if (englishSource === pending) {
          englishSource = null
        }
        throw error
      })
    englishSource = pending
  }
  return englishSource
}

export class PluginLanguagePackRegistry extends PluginArtifactPackRegistry<
  LanguagePackContribution,
  PluginLanguagePackRegistration
> {
  constructor(contentVerifier: PluginContentVerifier) {
    super({
      contentVerifier,
      contributions: (plugin) => plugin.manifest.contributes.languagePacks,
      load: async (plugin, contribution) => {
        const text = await readContainedPluginArtifactText(
          plugin.rootDir,
          contribution.path,
          PLUGIN_LANGUAGE_PACK_MAX_BYTES
        )
        const [
          english,
          { parsePluginLanguagePackArtifact, pluginLanguageResourceId },
          { pluginLanguagePackCoverage }
        ] = await Promise.all([
          loadEnglishSource(),
          import('../../../shared/plugins/artifacts/plugin-language-pack-artifact'),
          import('../../../shared/plugins/languages/plugin-language-pack-coverage')
        ])
        const parsed = parsePluginLanguagePackArtifact(text, 'tolerant', english.lookup)
        if (!parsed.ok) {
          throw new Error(`language pack "${contribution.locale}" ${parsed.error}`)
        }
        const id = `plugin:${plugin.pluginKey}/${contribution.locale}` as const
        return {
          id,
          resourceLanguage: pluginLanguageResourceId(id),
          pluginKey: plugin.pluginKey,
          locale: contribution.locale,
          ...(contribution.displayName ? { displayName: contribution.displayName } : {}),
          catalog: parsed.catalog,
          coverage: pluginLanguagePackCoverage(parsed.catalog, english.translatablePaths)
        }
      }
    })
  }
}
