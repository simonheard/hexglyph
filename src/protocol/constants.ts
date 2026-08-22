export const V1 = {
  magic: new Uint8Array([0x48, 0x47, 0x31, 0x21]), // HG1!
  version: 1,
  sizes: [13, 17, 21, 25, 29, 33, 37, 41],
  quietCells: 3,
  gapRatio: 0.16,
  markerRatio: 0.40,
  colors: ['#17191d', '#ef4638', '#4fbd48', '#13bad2'],
  markerLight: '#f5f1e8',
  profiles: {
    low: { label: 'Low · 12%', ratio: 0.12 },
    medium: { label: 'Medium · 20%', ratio: 0.20 },
    high: { label: 'High · 30%', ratio: 0.30 },
    extreme: { label: 'Extreme · 40%', ratio: 0.40 }
  }
} as const;
export const V2 = {
  ...V1,
  magic: new Uint8Array([0x48, 0x47, 0x32, 0x21]), // HG2!
  version: 2,
  sizes: [13, 17, 21, 25, 29, 33, 37, 41, 45, 49],
  gapRatio: 0,
  markerRatio: 0.40
} as const;
export const SUPPORTED_SIZES=[...new Set([...V1.sizes,...V2.sizes])].sort((a,b)=>a-b);
export type EccProfile = keyof typeof V1.profiles;
export type DensityMode = 'robust' | 'dense';
