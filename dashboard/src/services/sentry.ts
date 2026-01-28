import * as Sentry from "@sentry/react";
import { ScopeContext } from "@sentry/types";

// Extend ScopeContext to make all properties optional
interface OptionalScopeContext extends Partial<ScopeContext> {}

interface PerformanceMetrics {
  network: {
    effectiveType?: string; // Chrome/Edge only - Returns '4g', '3g', '2g', 'slow-2g'
    downlink?: number; // Chrome/Edge only - Effective bandwidth in Mbps
    rtt?: number; // Chrome/Edge only - Round-trip time in ms
    saveData?: boolean; // Chrome/Edge only - User's reduced data usage preference
  };
  timing: {
    ttfb: number | null; // All browsers - Time to First Byte
    domContentLoaded: number | null; // All browsers - DOM Content Loaded time
    loadComplete: number | null; // All browsers - Full page load time
  };
  memory: {
    used: number; // Chrome/Edge only - Used JS heap size in MB
    limit: number; // Chrome/Edge only - JS heap size limit in MB
    percentage: string; // Chrome/Edge only - Memory usage percentage
  } | null; // null if not Chrome/Edge
  slowResources: Array<{ name: string; duration: number }>; // All browsers - Resources taking >2s to load
}

interface PerformanceTags {
  connection_quality: "very_bad" | "bad" | "ok" | "good" | "excellent" | "unknown";
  page_load_speed: "very_slow" | "slow" | "ok" | "fast" | "unknown";
  memory_pressure: "critical" | "high" | "medium" | "low" | "unknown";
  network_type: string;
  has_slow_resources: "yes" | "no";
}

function getConnectionQuality(
  ttfb: number | null,
  effectiveType?: string,
  rtt?: number,
): PerformanceTags["connection_quality"] {
  // Priority 1: Use TTFB if available (most reliable)
  if (ttfb !== null) {
    if (ttfb < 100) return "excellent"; // < 100ms
    if (ttfb < 200) return "good"; // 100-200ms
    if (ttfb < 500) return "ok"; // 200-500ms
    if (ttfb < 1000) return "bad"; // 500-1000ms
    return "very_bad"; // > 1000ms
  }

  // Priority 2: Use Network Information API
  if (effectiveType) {
    if (effectiveType === "4g") return "good";
    if (effectiveType === "3g") return "ok";
    if (effectiveType === "2g") return "bad";
    if (effectiveType === "slow-2g") return "very_bad";
  }

  // Priority 3: Use RTT
  if (rtt !== undefined) {
    if (rtt < 100) return "excellent";
    if (rtt < 300) return "good";
    if (rtt < 600) return "ok";
    if (rtt < 1000) return "bad";
    return "very_bad";
  }

  return "unknown";
}

function getPageLoadSpeed(
  domContentLoaded: number | null,
  loadComplete: number | null,
): PerformanceTags["page_load_speed"] {
  const metric = loadComplete || domContentLoaded;

  if (metric === null) return "unknown";

  if (metric < 1000) return "fast"; // < 1s
  if (metric < 2500) return "ok"; // 1-2.5s
  if (metric < 4000) return "slow"; // 2.5-4s
  return "very_slow"; // > 4s
}

function getMemoryPressure(memory: PerformanceMetrics["memory"]): PerformanceTags["memory_pressure"] {
  if (!memory) return "unknown";

  const percentage = Number.parseFloat(memory.percentage);

  if (percentage < 50) return "low";
  if (percentage < 70) return "medium";
  if (percentage < 85) return "high";
  return "critical";
}

export function getPerformanceContext(): {
  metrics: PerformanceMetrics;
  tags: PerformanceTags;
} {
  interface NavigatorConnection {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  }

  interface NavigatorWithConnection extends Navigator {
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  }

  interface PerformanceMemory {
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
  }

  interface PerformanceWithMemory extends Performance {
    memory?: PerformanceMemory;
  }

  const connection =
    (navigator as NavigatorWithConnection).connection ||
    (navigator as NavigatorWithConnection).mozConnection ||
    (navigator as NavigatorWithConnection).webkitConnection;

  // Navigation timing
  const navTiming = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

  const timing = {
    ttfb: navTiming ? Math.round(navTiming.responseStart - navTiming.requestStart) : null,
    domContentLoaded: navTiming ? Math.round(navTiming.domContentLoadedEventEnd - navTiming.fetchStart) : null,
    loadComplete: navTiming ? Math.round(navTiming.loadEventEnd - navTiming.fetchStart) : null,
  };

  // Network info
  const network = {
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink ? Math.round(connection.downlink * 10) / 10 : undefined,
    rtt: connection?.rtt,
    saveData: connection?.saveData,
  };

  // Memory
  const performanceWithMemory = performance as PerformanceWithMemory;
  const memory = performanceWithMemory.memory
    ? {
        used: Math.round(performanceWithMemory.memory.usedJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(performanceWithMemory.memory.jsHeapSizeLimit / 1024 / 1024), // MB
        percentage: ((performanceWithMemory.memory.usedJSHeapSize / performanceWithMemory.memory.jsHeapSizeLimit) * 100).toFixed(1),
      }
    : null;

  // Slow resources
  const slowResources = performance
    .getEntriesByType("resource")
    .filter((r) => r.duration > 2000)
    .slice(0, 5)
    .map((r) => ({
      name: r.name.split("?")[0].substring(0, 100), // Remove query params and limit length
      duration: Math.round(r.duration),
    }));

  // Generate metrics object
  const metrics: PerformanceMetrics = {
    network,
    timing,
    memory,
    slowResources,
  };

  // Generate easy-to-read tags
  const tags: PerformanceTags = {
    connection_quality: getConnectionQuality(timing.ttfb, network.effectiveType, network.rtt),
    page_load_speed: getPageLoadSpeed(timing.domContentLoaded, timing.loadComplete),
    memory_pressure: getMemoryPressure(memory),
    network_type: network.effectiveType || "unknown",
    has_slow_resources: slowResources.length > 0 ? "yes" : "no",
  };

  return { metrics, tags };
}

export const capture = (err: Error | string, context: OptionalScopeContext = {}): void => {
  if (process.env.NODE_ENV === "development") console.log("capture", err, context);

  if (!context) {
    if (typeof err === "string") {
      Sentry.captureMessage(err);
    } else {
      Sentry.captureException(err);
    }
    return;
  }

  try {
    context = JSON.parse(JSON.stringify(context)); // deep copy context
  } catch (e) {
    console.error("Error parsing context", e);
    return;
  }

  // @ts-expect-error Property 'status' does not exist on type 'unknown'
  if (context?.extra?.response?.status === 401) return;

  if (context.extra) {
    const newExtra: Record<string, string> = {};
    for (const extraKey of Object.keys(context.extra)) {
      const extraValue = context.extra[extraKey];
      if (typeof extraValue === "string") {
        newExtra[extraKey] = extraValue;
      } else {
        // Sanitize password fields
        const extraValueObj = extraValue as Record<string, unknown>;
        if (extraValueObj && "password" in extraValueObj) {
          extraValueObj.password = "******";
        }
        newExtra[extraKey] = JSON.stringify(extraValue);
      }
    }
    context.extra = newExtra;
  }

  // Add performance context
  try {
    const { metrics, tags } = getPerformanceContext();

    if (!context.contexts) {
      context.contexts = {};
    }
    context.contexts.performance = metrics as unknown as Record<string, unknown>;

    if (!context.tags) {
      context.tags = {};
    }
    context.tags = { ...context.tags, ...tags };
  } catch (e) {
    console.error("Failed to get performance context", e);
  }

  if (Sentry && err) {
    if (typeof err === "string") {
      Sentry.captureMessage(err, context);
    } else {
      Sentry.captureException(err, context);
    }
  } else {
    console.log("capture", err, JSON.stringify(context));
  }
};

export const AppSentry = Sentry;
