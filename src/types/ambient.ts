export type AmbientSoundType =
  | 'rain'
  | 'ocean'
  | 'whiteNoise'
  | 'brownNoise'
  | 'alpha10'
  | 'beta16'
  | 'gamma40';

export type AmbientSoundGroup = 'natural' | 'noise' | 'binaural';

export interface AmbientSound {
  id: AmbientSoundType;
  label: string;
  description: string;
  group: AmbientSoundGroup;
  badge?: string;
  requiresHeadphones?: boolean;
  beatHz?: number;
}

export const AMBIENT_SOUNDS: AmbientSound[] = [
  {
    id: 'rain',
    label: 'Rain',
    description: 'Suara hujan lembut',
    group: 'natural',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Gelombang laut',
    group: 'natural',
  },
  {
    id: 'whiteNoise',
    label: 'White Noise',
    description: 'Noise klasik untuk masking',
    group: 'noise',
  },
  {
    id: 'brownNoise',
    label: 'Brown Noise',
    description: 'Noise hangat dan dalam',
    group: 'noise',
  },
  {
    id: 'alpha10',
    label: 'Alpha 10Hz',
    description: 'Eksperimen calm focus',
    group: 'binaural',
    badge: 'Experimental',
    requiresHeadphones: true,
    beatHz: 10,
  },
  {
    id: 'beta16',
    label: 'Beta 16Hz',
    description: 'Eksperimen alert focus',
    group: 'binaural',
    badge: 'Experimental',
    requiresHeadphones: true,
    beatHz: 16,
  },
  {
    id: 'gamma40',
    label: 'Gamma 40Hz',
    description: 'Eksperimen deep focus',
    group: 'binaural',
    badge: 'Experimental',
    requiresHeadphones: true,
    beatHz: 40,
  },
];

export const AMBIENT_SOUND_GROUPS: {
  id: AmbientSoundGroup;
  label: string;
  description: string;
}[] = [
  {
    id: 'natural',
    label: 'Natural',
    description: 'Soundscape lembut untuk ruang kerja yang tenang.',
  },
  {
    id: 'noise',
    label: 'Noise',
    description: 'Lapisan stabil untuk membantu menutup distraksi sekitar.',
  },
  {
    id: 'binaural',
    label: 'Binaural Lab',
    description: 'Mode eksperimental. Gunakan headphones stereo.',
  },
];
