/**
 * Provider registry system for OpenGuard
 *
 * Provides a central registry for AI providers and a plugin system for
 * dynamically loading providers from third-party packages.
 */

import type { AIProvider } from './base.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderMetadata {
  description?: string;
  version?: string;
  capabilities?: string[];
  registeredAt: Date;
}

export interface RegistryStats {
  totalProviders: number;
  defaultProvider?: string;
  registeredProviders: string[];
}

export interface ProviderPlugin {
  name: string;
  createProvider: (config?: unknown) => AIProvider;
  metadata?: {
    version?: string;
    description?: string;
    dependencies?: string[];
  };
}

export interface IProviderRegistry {
  register(name: string, provider: AIProvider, metadata?: Omit<ProviderMetadata, 'registeredAt'>): void;
  get(name: string): AIProvider;
  has(name: string): boolean;
  list(): string[];
  getDefault(): AIProvider;
  setDefault(name: string): void;
  unregister(name: string): boolean;
  clear(): void;
  getStats(): RegistryStats;
  getMetadata(name: string): ProviderMetadata | undefined;
}

// ---------------------------------------------------------------------------
// ProviderRegistry implementation
// ---------------------------------------------------------------------------

class ProviderRegistry implements IProviderRegistry {
  private readonly _providers = new Map<string, AIProvider>();
  private readonly _metadata = new Map<string, ProviderMetadata>();
  private _default: string | undefined;

  register(
    name: string,
    provider: AIProvider,
    meta?: Omit<ProviderMetadata, 'registeredAt'>
  ): void {
    if (this._providers.has(name)) {
      throw new Error(`Provider '${name}' is already registered`);
    }
    this._providers.set(name, provider);
    this._metadata.set(name, { ...meta, registeredAt: new Date() });
    if (this._default === undefined) this._default = name;
  }

  get(name: string): AIProvider {
    const p = this._providers.get(name);
    if (!p) throw new Error(`Provider '${name}' not found`);
    return p;
  }

  has(name: string): boolean {
    return this._providers.has(name);
  }

  list(): string[] {
    return [...this._providers.keys()];
  }

  getDefault(): AIProvider {
    if (this._default === undefined || !this._providers.has(this._default)) {
      throw new Error('No default provider set');
    }
    return this._providers.get(this._default)!;
  }

  setDefault(name: string): void {
    if (!this._providers.has(name)) throw new Error(`Provider '${name}' not found`);
    this._default = name;
  }

  unregister(name: string): boolean {
    if (!this._providers.has(name)) return false;
    this._providers.delete(name);
    this._metadata.delete(name);
    if (this._default === name) {
      this._default = this._providers.keys().next().value;
    }
    return true;
  }

  clear(): void {
    this._providers.clear();
    this._metadata.clear();
    this._default = undefined;
  }

  getStats(): RegistryStats {
    return {
      totalProviders: this._providers.size,
      defaultProvider: this._default,
      registeredProviders: this.list(),
    };
  }

  getMetadata(name: string): ProviderMetadata | undefined {
    return this._metadata.get(name);
  }
}

// ---------------------------------------------------------------------------
// PluginRegistry implementation
// ---------------------------------------------------------------------------

class PluginRegistry {
  private readonly _plugins = new Map<string, ProviderPlugin>();
  private readonly _providerRegistry: IProviderRegistry;

  constructor(providerRegistry: IProviderRegistry) {
    this._providerRegistry = providerRegistry;
  }

  register(plugin: ProviderPlugin): void {
    if (this._plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    this._plugins.set(plugin.name, plugin);
  }

  get(name: string): ProviderPlugin {
    const p = this._plugins.get(name);
    if (!p) throw new Error(`Plugin '${name}' not found`);
    return p;
  }

  list(): string[] {
    return [...this._plugins.keys()];
  }

  /** Silently ignores if the plugin does not exist. */
  unregister(name: string): void {
    this._plugins.delete(name);
  }

  /**
   * Instantiate a provider from a plugin and register it in the provider registry.
   *
   * @param pluginName    Name of the plugin to load from
   * @param providerName  Name under which to register the resulting provider
   * @param config        Optional config passed to plugin.createProvider()
   */
  async loadProvider(
    pluginName: string,
    providerName: string,
    config?: unknown
  ): Promise<void> {
    const plugin = this._plugins.get(pluginName);
    if (!plugin) throw new Error(`Plugin '${pluginName}' not found`);

    const provider = plugin.createProvider(config);

    const meta: Omit<ProviderMetadata, 'registeredAt'> = {
      description: plugin.metadata?.description,
      version: plugin.metadata?.version,
    };

    this._providerRegistry.register(providerName, provider, meta);
  }
}

// ---------------------------------------------------------------------------
// RegistryFactory
// ---------------------------------------------------------------------------

export const RegistryFactory = {
  createProviderRegistry(): IProviderRegistry {
    return new ProviderRegistry();
  },

  createPluginRegistry(providerRegistry: IProviderRegistry): PluginRegistry {
    return new PluginRegistry(providerRegistry);
  },

  createRegistrySystem(): { providers: IProviderRegistry; plugins: PluginRegistry } {
    const providers = new ProviderRegistry();
    const plugins = new PluginRegistry(providers);
    return { providers, plugins };
  },
} as const;

// ---------------------------------------------------------------------------
// Global singletons
// ---------------------------------------------------------------------------

export const providerRegistry: IProviderRegistry = new ProviderRegistry();
export const pluginRegistry = new PluginRegistry(providerRegistry);
