export interface DeviceProfile {
  memoryGB: number | null;
  cores: number;
  hasWebGPU: boolean;
  hasWASM: boolean;
  isMobile: boolean;
  isSafari: boolean;
  browser: string;
}

export type DeviceTier = 'high' | 'mid' | 'low';

export async function detectDevice(): Promise<DeviceProfile> {
  const nav = globalThis.navigator as Navigator & {
    gpu?: { requestAdapter(): Promise<unknown | null> };
    deviceMemory?: number;
  };

  let hasWebGPU = false;
  if (nav.gpu) {
    try { hasWebGPU = !!(await nav.gpu.requestAdapter()); } catch { /* */ }
  }

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
    hasWASM: typeof WebAssembly === 'object',
    isMobile,
    isSafari,
    browser,
  };
}

export function classifyTier(d: DeviceProfile): DeviceTier {
  const mem = d.memoryGB;
  if (mem !== null) {
    if (mem >= 12) return 'high';
    if (mem >= 6) return 'mid';
    return 'low';
  }
  if (!d.isMobile && d.cores >= 8) return 'mid';
  return 'low';
}
