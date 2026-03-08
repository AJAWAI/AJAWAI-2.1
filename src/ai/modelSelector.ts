import { detectDeviceProfile, classifyTier, type DeviceProfile, type DeviceTier } from './deviceCapability';
import { getProfileForTier, type ModelProfile } from './modelProfiles';

export interface ModelSelection {
  profile: ModelProfile;
  tier: DeviceTier;
  device: DeviceProfile;
  reason: string;
}

export async function selectModel(): Promise<ModelSelection> {
  const device = await detectDeviceProfile();
  const tier = classifyTier(device);
  const profile = getProfileForTier(tier);

  let reason: string;
  if (device.memoryGB !== null) {
    reason = `${device.memoryGB} GB RAM → ${tier} tier`;
  } else if (device.isSafari && device.isMobile) {
    reason = 'Mobile Safari → low tier';
  } else {
    reason = `${device.cores} cores, memory unknown → ${tier} tier`;
  }

  return { profile, tier, device, reason };
}
