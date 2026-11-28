import type { PluginEventName } from '../../../shared/plugins/manifest/plugin-manifest'
import type {
  PluginDataArea,
  PluginWorkerPanelPost
} from '../../../shared/plugins/workers/plugin-panel-bridge-protocol'
import type {
  PluginPanelBridge,
  PluginPanelBridgeDependencies,
  PluginPanelRequest
} from './plugin-panel-bridge'

export class LazyPluginPanelBridge {
  private bridge: PluginPanelBridge | null = null
  private pending: Promise<PluginPanelBridge> | null = null
  private disposed = false

  constructor(private readonly deps: PluginPanelBridgeDependencies) {}

  private load(): Promise<PluginPanelBridge> {
    if (this.bridge) {
      return Promise.resolve(this.bridge)
    }
    if (!this.pending) {
      const pending = import('./plugin-panel-bridge')
        .then(({ PluginPanelBridge }) => {
          const bridge = new PluginPanelBridge(this.deps)
          if (this.disposed) {
            bridge.dispose()
          }
          this.bridge = bridge
          return bridge
        })
        .catch((error: unknown) => {
          if (this.pending === pending) {
            this.pending = null
          }
          throw error
        })
      this.pending = pending
    }
    return this.pending
  }

  async open(
    ...args: Parameters<PluginPanelBridge['open']>
  ): Promise<ReturnType<PluginPanelBridge['open']>> {
    return (await this.load()).open(...args)
  }

  close(panelId: string): void {
    this.bridge?.close(panelId)
  }

  async subscribe(...args: Parameters<PluginPanelBridge['subscribe']>): Promise<void> {
    ;(await this.load()).subscribe(...args)
  }

  hasSubscribers(event: PluginEventName): boolean {
    return this.bridge?.hasSubscribers(event) ?? false
  }

  async request(request: PluginPanelRequest): ReturnType<PluginPanelBridge['request']> {
    return (await this.load()).request(request)
  }

  onWorkerPost(pluginKey: string, post: PluginWorkerPanelPost): void {
    this.bridge?.onWorkerPost(pluginKey, post)
  }

  publishEvent(event: PluginEventName, raw: unknown, only?: { pluginKey: string }): number {
    return this.bridge?.publishEvent(event, raw, only) ?? 0
  }

  dataChanged(pluginKey: string, area: PluginDataArea, key: string): void {
    if (this.bridge) {
      this.bridge.dataChanged(pluginKey, area, key)
      return
    }
    this.deps.runningWorker(pluginKey)?.notifyDataChanged({ area, key })
  }

  dispose(): void {
    this.disposed = true
    this.bridge?.dispose()
  }
}
