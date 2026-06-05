/**
 * Team monitoring metadata system
 *
 * Sub-path import (tree-shakable):
 * ```ts
 * import { AppRegistry, MonitoringAggregator, appRegistry, monitoringAggregator } from 'openguard/monitoring';
 * ```
 *
 * Also re-exported from the root entry:
 * ```ts
 * import { AppRegistry, monitoringAggregator } from 'openguard';
 * ```
 */

// Registry
export { AppRegistry, appRegistry } from './registry.js';

// Aggregator
export { MonitoringAggregator, monitoringAggregator } from './aggregator.js';

// All types
export type {
  Environment,
  AppContext,
  AppMetrics,
  AppProfile,
  TeamReport,
  ProjectReport,
  MonitoringFilter,
} from './types.js';
