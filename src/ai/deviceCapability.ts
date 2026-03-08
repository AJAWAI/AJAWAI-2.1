export interface DeviceProfile {
  memoryGB: number | null;
  cores: number;
  hasWebGPU: boolean;
  hasWASM: boolean;
  isMobile: boolean;
  isSafari: boolean;
  browser: string;
}

export type DeviceTier = 'high' | 'medium' | 'low';

export async function detectDeviceProfile(): Promise<DeviceProfile> {
  const nav = globalThis.navigator as Navigator & {
    gpu?: { requestAdapter(): Promise<unknown | null> };
    deviceMemory?: number;
  };

  let hasWebGPU = false;
  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      hasWebGPU = !!adapter;
    } catch { /* unavailable */ }
  }

  const hasWASM = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  const ua = nav.userAgent ?? '';
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium/i.test(ua);

  let browser = 'unknown';
  if (/Firefox/i.test(ua)) browser = 'firefox';
  else if (/Edg/i.test(ua)) browser = 'edge';
  else if (isSafari) browser = 'safari';
  else if (/Chrome/i.test(ua)) browser = 'chrome';

  return {
    memoryGB: nav.deviceMemory ?? null,
    cores: nav.hardwareConcurrency ?? 2,
    hasWebGPU,
    hasWASM,
    isMobile,
    isSafari,
    browser,
  };
}

export function classifyTier(profile: DeviceProfile): DeviceTier {
  const mem = profile.memoryGB;

  if (profile.isSafari && profile.isMobile) return 'low';

  if (mem !== null) {
    if (mem >= 12) return 'high';
    if (mem >= 8) return 'medium';
    return 'low';
  }

  if (!profile.isMobile && profile.cores >= 8) return 'medium';
  return 'low';
}
