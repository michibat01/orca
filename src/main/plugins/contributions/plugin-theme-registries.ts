import { createHash } from 'node:crypto'
import type { PluginThemeContribution } from '../../../shared/plugins/contributions/plugin-content-pack-contributions'
import type { PluginThemeRegistration } from '../../../shared/plugins/artifacts/plugin-theme-artifact'
import type { PluginTerminalThemeRegistration } from '../../../shared/plugins/artifacts/plugin-terminal-theme-artifact'
import { PLUGIN_THEME_MAX_BYTES } from '../artifacts/plugin-artifact-validation'
import { readContainedPluginArtifactText } from '../artifacts/plugin-contained-artifact'
import { PluginArtifactPackRegistry } from './plugin-artifact-pack-registry'
import type { PluginContentVerifier } from '../artifacts/plugin-content-integrity'
import type { ValidDiscoveredPlugin } from '../discovery/plugin-discovery'

async function readTheme<T>(
  plugin: ValidDiscoveredPlugin,
  contribution: PluginThemeContribution,
  kind: string,
  parse: (text: string) => T
): Promise<
  T & {
    id: `plugin:${string}`
    revision: string
    pluginKey: string
    pluginName: string
    label: string
  }
> {
  const text = await readContainedPluginArtifactText(
    plugin.rootDir,
    contribution.path,
    PLUGIN_THEME_MAX_BYTES
  )
  try {
    return {
      ...parse(text),
      id: `plugin:${plugin.pluginKey}/${contribution.id}`,
      revision: createHash('sha256').update(text).digest('hex').slice(0, 32),
      pluginKey: plugin.pluginKey,
      pluginName: plugin.manifest.name,
      label: contribution.title
    }
  } catch (error) {
    throw new Error(
      `${kind} "${contribution.id}" is invalid: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export function createPluginThemeRegistry(
  contentVerifier: PluginContentVerifier,
  overlay?: (entries: readonly PluginThemeRegistration[]) => readonly PluginThemeRegistration[]
) {
  return new PluginArtifactPackRegistry<PluginThemeContribution, PluginThemeRegistration>({
    contentVerifier,
    overlay,
    contributions: (plugin) => plugin.manifest.contributes.themes,
    load: async (plugin, contribution) => {
      const [{ parsePluginAppThemeArtifact }, { resolvePluginThemeBackground }] = await Promise.all(
        [
          import('../../../shared/plugins/artifacts/plugin-theme-artifact'),
          import('./plugin-theme-background-image')
        ]
      )
      const { background, ...theme } = await readTheme(
        plugin,
        contribution,
        'theme',
        parsePluginAppThemeArtifact
      )
      const image = resolvePluginThemeBackground(
        plugin,
        plugin.manifest.contributes.themes.indexOf(contribution),
        background
      )
      return image ? { ...theme, background: image } : theme
    }
  })
}

export function createPluginTerminalThemeRegistry(
  contentVerifier: PluginContentVerifier,
  overlay?: (
    entries: readonly PluginTerminalThemeRegistration[]
  ) => readonly PluginTerminalThemeRegistration[]
) {
  return new PluginArtifactPackRegistry<PluginThemeContribution, PluginTerminalThemeRegistration>({
    contentVerifier,
    overlay,
    contributions: (plugin) => plugin.manifest.contributes.terminalThemes,
    load: async (plugin, contribution) => {
      const { parsePluginTerminalThemeArtifact } =
        await import('../../../shared/plugins/artifacts/plugin-terminal-theme-artifact')
      return readTheme(plugin, contribution, 'terminal theme', parsePluginTerminalThemeArtifact)
    }
  })
}
