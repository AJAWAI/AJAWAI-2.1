import type { DeviceCapabilities } from '../lib/types';

export async function detectCapabilities(): Promise<DeviceCapabilities> {
  const nav = globalThis.navigator as Navigator & {
    gpu?: { requestAdapter(): Promise<{ name?: string } | null> };
    deviceMemory?: number;
  };

  let webgpu = false;
  let gpuName: string | null = null;

  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) {
        webgpu = true;
        gpuName = adapter.name ?? 'Unknown GPU';
      }
    } catch {
      /* WebGPU not available */
    }
  }

  let wasm = false;
  try {
    wasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
  } catch {
    /* WASM not available */
  }

  let sharedArrayBuffer = false;
  try {
    sharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  } catch {
    /* SAB not available */
  }

  return {
    webgpu,
    wasm,
    sharedArrayBuffer,
    deviceMemory: nav.deviceMemory ?? null,
    hardwareConcurrency: nav.hardwareConcurrency ?? 1,
    gpu: gpuName,
  };
}
