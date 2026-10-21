// audio.js - Web Audio API Sound System
class SoundController {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.initAudioContext();
  }

  initAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
    }
  }

  ensureContext() {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.bgmPlaying) {
      this.stopBgm();
    } else if (!this.muted && !this.bgmPlaying) {
      this.startBgm();
    }
    return this.muted;
  }

  playShoot() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    // Laser zap oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playHit() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    // Punchy hit thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  playFall() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    // Comical slide whistle descent
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.6);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  playMiss() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const now = this.ctx.currentTime;

    // Harsh buzzer for missed zombie
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(140, now);
    osc2.frequency.setValueAtTime(148, now); // Dissonant beating

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  }

  playLevelUp() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  playGameOver() {
    if (this.muted || !this.ctx) return;
    this.ensureContext();
    const notes = [440, 415.3, 392, 349.2, 311.1]; // Descending sad notes
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + idx * 0.2;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  // Upbeat synthwave background loop
  startBgm() {
    if (this.muted || this.bgmPlaying || !this.ctx) return;
    this.ensureContext();
    this.bgmPlaying = true;

    const bassLine = [110, 110, 130.8, 146.8, 110, 110, 98, 87.3];
    const melody = [440, 523.25, 659.25, 587.33, 440, 659.25, 523.25, 392];
    let step = 0;

    const tick = () => {
      if (!this.bgmPlaying || this.muted || !this.ctx) return;

      const now = this.ctx.currentTime;
      const bassFreq = bassLine[step % bassLine.length];
      const melFreq = melody[step % melody.length];

      // Bass plop
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'triangle';
      bOsc.frequency.setValueAtTime(bassFreq / 2, now);
      bGain.gain.setValueAtTime(0.08, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      bOsc.connect(bGain);
      bGain.connect(this.ctx.destination);
      bOsc.start(now);
      bOsc.stop(now + 0.18);

      // Synth arp (every 2 steps)
      if (step % 2 === 0) {
        const mOsc = this.ctx.createOscillator();
        const mGain = this.ctx.createGain();
        mOsc.type = 'sine';
        mOsc.frequency.setValueAtTime(melFreq, now);
        mGain.gain.setValueAtTime(0.04, now);
        mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        mOsc.connect(mGain);
        mGain.connect(this.ctx.destination);
        mOsc.start(now);
        mOsc.stop(now + 0.22);
      }

      step++;
      this.bgmTimer = setTimeout(tick, 180); // ~166 BPM 8th notes
    };

    tick();
  }

  stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

window.soundController = new SoundController();
