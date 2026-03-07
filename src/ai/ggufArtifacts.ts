const HF_BASE = 'https://huggingface.co/seanbailey518/Step3-VL-10B-GGUF/resolve/main';

export type GgufFileMode = 'single' | 'split';

export interface GgufArtifactConfig {
  label: string;
  quantization: string;
  contextWindow: number;
  fileSizeBytes: number;
  estimatedRuntimeGB: number;
  fileMode: GgufFileMode;
  urls: string[];
  mmprojUrl: string | null;
}

export const STEP_GGUF_ARTIFACTS: Record<string, GgufArtifactConfig> = {
  'q4_k_m': {
    label: 'STEP-3-VL-10B Q4_K_M',
    quantization: 'Q4_K_M',
    contextWindow: 1024,
    fileSizeBytes: 5_027_784_512,
    estimatedRuntimeGB: 6.5,
    fileMode: 'single',
    urls: [
      `${HF_BASE}/Step3-VL-10B-Q4_K_M.gguf`,
    ],
    mmprojUrl: `${HF_BASE}/mmproj-Step3-VL-10b-F16.gguf`,
  },
  'q3_k_m': {
    label: 'STEP-3-VL-10B Q3_K_M',
    quantization: 'Q3_K_M',
    contextWindow: 1024,
    fileSizeBytes: 4_124_161_856,
    estimatedRuntimeGB: 5.5,
    fileMode: 'single',
    urls: [
      `${HF_BASE}/Step3-VL-10B-Q3_K_M.gguf`,
    ],
    mmprojUrl: `${HF_BASE}/mmproj-Step3-VL-10b-F16.gguf`,
  },
  'iq4_xs': {
    label: 'STEP-3-VL-10B IQ4_XS',
    quantization: 'IQ4_XS',
    contextWindow: 1024,
    fileSizeBytes: 4_593_297_216,
    estimatedRuntimeGB: 6.0,
    fileMode: 'single',
    urls: [
      `${HF_BASE}/Step3-VL-10B-IQ4_XS.gguf`,
    ],
    mmprojUrl: `${HF_BASE}/mmproj-Step3-VL-10b-F16.gguf`,
  },
};

export const DEFAULT_GGUF_VARIANT = 'q3_k_m';

export interface ArtifactCheckResult {
  url: string;
  label: string;
  reachable: boolean;
  httpStatus: number | null;
  contentLength: number | null;
  error: string | null;
}

function statusLabel(status: number): string {
  if (status === 200 || status === 302) return 'OK';
  if (status === 401) return 'auth required';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not found';
  return `HTTP ${status}`;
}

export async function checkArtifactUrl(url: string, label: string): Promise<ArtifactCheckResult> {
  try {
    const r = await fetch(url, { method: 'HEAD', mode: 'cors', redirect: 'follow' });
    const cl = r.headers.get('content-length');
    return {
      url,
      label,
      reachable: r.ok,
      httpStatus: r.status,
      contentLength: cl ? parseInt(cl, 10) : null,
      error: r.ok ? null : statusLabel(r.status),
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
    config.urls.map((url, i) => {
      const label = config.fileMode === 'single' && config.urls.length === 1
        ? `${config.quantization} model file`
        : `shard ${i + 1} of ${config.urls.length}`;
      return checkArtifactUrl(url, label);
    }),
  );

  let mmprojCheck: ArtifactCheckResult | null = null;
  if (config.mmprojUrl) {
    mmprojCheck = await checkArtifactUrl(config.mmprojUrl, 'mmproj (vision, optional)');
  }

  const valid = checks.every((c) => c.reachable);
  return { valid, checks, mmprojCheck };
}
