export interface GgufArtifactConfig {
  label: string;
  quantization: string;
  contextWindow: number;
  estimatedSizeGB: number;
  estimatedRuntimeGB: number;
  urls: string[];
  mmprojUrl: string | null;
}

export const STEP_GGUF_ARTIFACTS: Record<string, GgufArtifactConfig> = {
  'q4_k_m': {
    label: 'STEP-3-VL-10B Q4_K_M',
    quantization: 'Q4_K_M',
    contextWindow: 1024,
    estimatedSizeGB: 6.5,
    estimatedRuntimeGB: 7.5,
    urls: [
      'https://huggingface.co/seanbailey518/Step3-VL-10B-GGUF/resolve/main/Step3-VL-10b-Q4_K_M.gguf',
    ],
    mmprojUrl: 'https://huggingface.co/seanbailey518/Step3-VL-10B-GGUF/resolve/main/mmproj-Step3-VL-10b-F16.gguf',
  },
  'q3_k_m': {
    label: 'STEP-3-VL-10B Q3_K_M',
    quantization: 'Q3_K_M',
    contextWindow: 1024,
    estimatedSizeGB: 4.9,
    estimatedRuntimeGB: 6.0,
    urls: [
      'https://huggingface.co/seanbailey518/Step3-VL-10B-GGUF/resolve/main/Step3-VL-10b-Q3_K_M.gguf',
    ],
    mmprojUrl: 'https://huggingface.co/seanbailey518/Step3-VL-10B-GGUF/resolve/main/mmproj-Step3-VL-10b-F16.gguf',
  },
};

export const DEFAULT_GGUF_VARIANT = 'q4_k_m';

export interface ArtifactCheckResult {
  url: string;
  label: string;
  reachable: boolean;
  httpStatus: number | null;
  contentLength: number | null;
  error: string | null;
}

export async function checkArtifactUrl(url: string, label: string): Promise<ArtifactCheckResult> {
  try {
    const r = await fetch(url, { method: 'HEAD', mode: 'cors' });
    const cl = r.headers.get('content-length');
    return {
      url,
      label,
      reachable: r.ok,
      httpStatus: r.status,
      contentLength: cl ? parseInt(cl, 10) : null,
      error: r.ok ? null : `HTTP ${r.status}`,
    };
  } catch (e) {
    return {
      url,
      label,
      reachable: false,
      httpStatus: null,
      contentLength: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function validateGgufArtifacts(
  config: GgufArtifactConfig,
): Promise<{ valid: boolean; checks: ArtifactCheckResult[]; mmprojCheck: ArtifactCheckResult | null }> {
  const checks = await Promise.all(
    config.urls.map((url, i) => checkArtifactUrl(url, `model shard ${i + 1}`)),
  );

  let mmprojCheck: ArtifactCheckResult | null = null;
  if (config.mmprojUrl) {
    mmprojCheck = await checkArtifactUrl(config.mmprojUrl, 'mmproj (vision)');
  }

  const valid = checks.every((c) => c.reachable);
  return { valid, checks, mmprojCheck };
}
