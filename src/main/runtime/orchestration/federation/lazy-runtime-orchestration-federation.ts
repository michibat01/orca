import type { OrchestrationEnvironmentTransport } from './environment-transport'
import type { FederationRuntime } from './federation-runtime'
import type { RuntimeOrchestrationFederation } from './runtime-orchestration-federation'

export class LazyRuntimeOrchestrationFederation {
  private instance: RuntimeOrchestrationFederation | null = null
  private pending: Promise<RuntimeOrchestrationFederation> | null = null
  private relayGeneration = 0

  constructor(
    private readonly runtime: FederationRuntime,
    private readonly transport: OrchestrationEnvironmentTransport | null
  ) {}

  private load(): Promise<RuntimeOrchestrationFederation> {
    if (this.instance) {
      return Promise.resolve(this.instance)
    }
    if (!this.pending) {
      const pending = import('./runtime-orchestration-federation')
        .then(({ RuntimeOrchestrationFederation }) => {
          this.instance = new RuntimeOrchestrationFederation(this.runtime, this.transport)
          return this.instance
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

  resetForDatabaseChange(): void {
    this.relayGeneration += 1
    this.instance?.resetForDatabaseChange()
  }

  async resolveWorkerServer(
    ...args: Parameters<RuntimeOrchestrationFederation['resolveWorkerServer']>
  ): ReturnType<RuntimeOrchestrationFederation['resolveWorkerServer']> {
    return (await this.load()).resolveWorkerServer(...args)
  }

  async listWorkerServers(): ReturnType<RuntimeOrchestrationFederation['listWorkerServers']> {
    return (await this.load()).listWorkerServers()
  }

  async callWorkerServer(
    ...args: Parameters<RuntimeOrchestrationFederation['callWorkerServer']>
  ): ReturnType<RuntimeOrchestrationFederation['callWorkerServer']> {
    return (await this.load()).callWorkerServer(...args)
  }

  async sync(
    ...args: Parameters<RuntimeOrchestrationFederation['sync']>
  ): ReturnType<RuntimeOrchestrationFederation['sync']> {
    return (await this.load()).sync(...args)
  }

  async syncDispatch(
    ...args: Parameters<RuntimeOrchestrationFederation['syncDispatch']>
  ): ReturnType<RuntimeOrchestrationFederation['syncDispatch']> {
    return (await this.load()).syncDispatch(...args)
  }

  async syncDispatchAfterCurrent(
    ...args: Parameters<RuntimeOrchestrationFederation['syncDispatchAfterCurrent']>
  ): ReturnType<RuntimeOrchestrationFederation['syncDispatchAfterCurrent']> {
    return (await this.load()).syncDispatchAfterCurrent(...args)
  }

  ensureRelay(...args: Parameters<RuntimeOrchestrationFederation['ensureRelay']>): void {
    if (this.instance) {
      this.instance.ensureRelay(...args)
      return
    }
    const generation = this.relayGeneration
    void this.load()
      .then((federation) => {
        if (this.relayGeneration === generation) {
          federation.ensureRelay(...args)
        }
      })
      .catch(() => undefined)
  }

  stopRelay(): void {
    this.relayGeneration += 1
    this.instance?.stopRelay()
  }
}
