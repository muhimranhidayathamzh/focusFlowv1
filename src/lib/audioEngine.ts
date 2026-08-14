import { AmbientSoundType } from '@/types/ambient';

/**
 * AudioEngine — generates ambient sounds using Web Audio API.
 * All sounds are synthesized in real-time, no audio files needed.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: AudioNode[] = [];
  private sessionGain: GainNode | null = null;
  private currentSound: AmbientSoundType | null = null;
  private _targetVolume: number = 0.5;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AC();
    }
    // Resume if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  private getMasterGain(): GainNode {
    if (!this.masterGain) {
      const ctx = this.getContext();
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this._targetVolume;
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  /**
   * Create a buffer filled with white noise
   */
  private createNoiseBuffer(ctx: AudioContext, durationSec: number = 2): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * durationSec;
    const buffer = ctx.createBuffer(2, bufferSize, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return buffer;
  }

  /**
   * 🌧️ Rain: Layered filtered noise simulating rain drops and patter
   */
  private startRain(ctx: AudioContext, output: GainNode): void {
    const buffer = this.createNoiseBuffer(ctx, 2);

    // Layer 1: Low rumble (distant thunder / heavy rain)
    const rumble = ctx.createBufferSource();
    rumble.buffer = buffer;
    rumble.loop = true;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 400;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.4;
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(output);
    rumble.start();
    this.activeNodes.push(rumble);

    // Layer 2: Mid-range patter
    const mid = ctx.createBufferSource();
    mid.buffer = buffer;
    mid.loop = true;
    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'bandpass';
    midFilter.frequency.value = 2000;
    midFilter.Q.value = 0.5;
    const midGain = ctx.createGain();
    midGain.gain.value = 0.15;
    mid.connect(midFilter);
    midFilter.connect(midGain);
    midGain.connect(output);
    mid.start();
    this.activeNodes.push(mid);

    // Layer 3: High-frequency sparkle (rain droplets on surface)
    const high = ctx.createBufferSource();
    high.buffer = buffer;
    high.loop = true;
    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'highpass';
    highFilter.frequency.value = 6000;
    const highGain = ctx.createGain();
    highGain.gain.value = 0.08;
    high.connect(highFilter);
    highFilter.connect(highGain);
    highGain.connect(output);
    high.start();
    this.activeNodes.push(high);
  }

  /**
   * 🌊 Ocean: Modulated noise with LFO for wave-like rhythm
   */
  private startOcean(ctx: AudioContext, output: GainNode): void {
    const buffer = this.createNoiseBuffer(ctx, 4);

    // Base ocean noise
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.Q.value = 1;

    // LFO to modulate volume (simulates waves crashing)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08; // Very slow: ~one wave every 12 seconds
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;

    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.5;

    // LFO modulates the wave gain
    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);

    source.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(output);

    // Secondary LFO for filter sweep
    const lfo2 = ctx.createOscillator();
    lfo2.type = 'sine';
    lfo2.frequency.value = 0.05;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 400;
    lfo2.connect(lfo2Gain);
    lfo2Gain.connect(filter.frequency);

    source.start();
    lfo.start();
    lfo2.start();
    this.activeNodes.push(source, lfo, lfo2);

    // Add a gentle high-frequency layer for foam
    const foam = ctx.createBufferSource();
    foam.buffer = buffer;
    foam.loop = true;
    const foamFilter = ctx.createBiquadFilter();
    foamFilter.type = 'bandpass';
    foamFilter.frequency.value = 3000;
    foamFilter.Q.value = 0.3;
    const foamGain = ctx.createGain();
    foamGain.gain.value = 0.06;

    const foamLfo = ctx.createOscillator();
    foamLfo.type = 'sine';
    foamLfo.frequency.value = 0.1;
    const foamLfoGain = ctx.createGain();
    foamLfoGain.gain.value = 0.05;
    foamLfo.connect(foamLfoGain);
    foamLfoGain.connect(foamGain.gain);

    foam.connect(foamFilter);
    foamFilter.connect(foamGain);
    foamGain.connect(output);
    foam.start();
    foamLfo.start();
    this.activeNodes.push(foam, foamLfo);
  }

  /**
   * 📻 White Noise: Pure white noise
   */
  private startWhiteNoise(ctx: AudioContext, output: GainNode): void {
    const buffer = this.createNoiseBuffer(ctx, 2);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Gentle rolloff so it's not too harsh
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 14000;

    const gain = ctx.createGain();
    gain.gain.value = 0.35;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start();
    this.activeNodes.push(source);
  }

  /**
   * 🍂 Brown Noise: Deep, warm noise (great for deep focus)
   */
  private startBrownNoise(ctx: AudioContext, output: GainNode): void {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    // Generate brown noise by integrating white noise
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Integration with leak factor
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5; // Amplify
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;

    const gain = ctx.createGain();
    gain.gain.value = 0.7;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start();
    this.activeNodes.push(source);
  }

  private startBinauralBeat(
    ctx: AudioContext,
    output: GainNode,
    beatHz: number
  ): void {
    const carrierHz = 220;
    const leftOsc = ctx.createOscillator();
    const rightOsc = ctx.createOscillator();
    const leftGain = ctx.createGain();
    const rightGain = ctx.createGain();
    const merger = ctx.createChannelMerger(2);

    leftOsc.type = 'sine';
    rightOsc.type = 'sine';
    leftOsc.frequency.value = carrierHz;
    rightOsc.frequency.value = carrierHz + beatHz;

    leftGain.gain.value = 0.08;
    rightGain.gain.value = 0.08;

    leftOsc.connect(leftGain);
    rightOsc.connect(rightGain);
    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);
    merger.connect(output);

    leftOsc.start();
    rightOsc.start();

    this.activeNodes.push(leftOsc, rightOsc, leftGain, rightGain, merger);
  }

  /**
   * Immediately stop and disconnect a set of nodes
   */
  private cleanupNodes(nodes: AudioNode[]): void {
    nodes.forEach((node) => {
      try {
        if (node instanceof AudioBufferSourceNode || node instanceof OscillatorNode) {
          node.stop();
        }
        node.disconnect();
      } catch {
        // Node may already be stopped
      }
    });
  }

  /**
   * Play a specific ambient sound
   */
  play(soundType: AmbientSoundType): void {
    // Capture old nodes and session gain BEFORE clearing
    const oldNodes = this.activeNodes;
    const oldSessionGain = this.sessionGain;

    // Immediately reset activeNodes so new play() gets a clean slate
    this.activeNodes = [];

    // Cleanup old nodes immediately (no setTimeout race condition)
    this.cleanupNodes(oldNodes);
    if (oldSessionGain) {
      try { oldSessionGain.disconnect(); } catch {}
    }

    const ctx = this.getContext();
    const master = this.getMasterGain();
    this.currentSound = soundType;

    // Create a fresh session gain node for this playback
    this.sessionGain = ctx.createGain();
    this.sessionGain.gain.value = 1;
    this.sessionGain.connect(master);

    // Ensure master gain is at the target volume
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(
      this._targetVolume,
      ctx.currentTime + 0.5
    );

    switch (soundType) {
      case 'rain':
        this.startRain(ctx, this.sessionGain);
        break;
      case 'ocean':
        this.startOcean(ctx, this.sessionGain);
        break;
      case 'whiteNoise':
        this.startWhiteNoise(ctx, this.sessionGain);
        break;
      case 'brownNoise':
        this.startBrownNoise(ctx, this.sessionGain);
        break;
      case 'alpha10':
        this.startBinauralBeat(ctx, this.sessionGain, 10);
        break;
      case 'beta16':
        this.startBinauralBeat(ctx, this.sessionGain, 16);
        break;
      case 'gamma40':
        this.startBinauralBeat(ctx, this.sessionGain, 40);
        break;
    }
  }

  /**
   * Stop all currently playing sounds with fade out
   */
  stop(): void {
    if (this.audioContext && this.masterGain) {
      const ctx = this.audioContext;
      // Capture refs for the delayed cleanup
      const nodesToClean = this.activeNodes;
      const sessionToClean = this.sessionGain;

      // Clear immediately so new play() won't be affected
      this.activeNodes = [];
      this.sessionGain = null;

      // Fade out on the master gain
      this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
      this.masterGain.gain.setValueAtTime(
        this.masterGain.gain.value,
        ctx.currentTime
      );
      this.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);

      // Schedule cleanup after fade completes — uses captured refs, not this.activeNodes
      setTimeout(() => {
        this.cleanupNodes(nodesToClean);
        if (sessionToClean) {
          try { sessionToClean.disconnect(); } catch {}
        }
      }, 350);
    }
    this.currentSound = null;
  }

  /**
   * Set master volume (0 to 1)
   */
  setVolume(value: number): void {
    this._targetVolume = value;
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.masterGain.gain.setValueAtTime(
        this.masterGain.gain.value,
        this.audioContext.currentTime
      );
      this.masterGain.gain.linearRampToValueAtTime(
        value,
        this.audioContext.currentTime + 0.1
      );
    }
  }

  /**
   * Get the currently playing sound type
   */
  getCurrentSound(): AmbientSoundType | null {
    return this.currentSound;
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.cleanupNodes(this.activeNodes);
    this.activeNodes = [];
    if (this.sessionGain) {
      try { this.sessionGain.disconnect(); } catch {}
      this.sessionGain = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.masterGain = null;
    }
  }
}
