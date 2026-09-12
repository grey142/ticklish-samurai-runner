export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain = 0.08, slide = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  jump(): void {
    this.blip(420, 0.12, "square", 0.05, 180);
  }

  doubleJump(): void {
    this.blip(560, 0.14, "square", 0.06, 240);
  }

  slam(): void {
    this.blip(90, 0.18, "sawtooth", 0.07, -40);
  }

  slash(): void {
    this.blip(880, 0.08, "sawtooth", 0.06, -400);
  }

  hit(): void {
    this.blip(220, 0.1, "triangle", 0.07, -80);
  }

  coin(): void {
    this.blip(980, 0.07, "sine", 0.04, 200);
  }

  laugh(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.09, 0.18].forEach((t, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(340 + i * 70, now + t);
      osc.frequency.exponentialRampToValueAtTime(520 + i * 40, now + t + 0.08);
      g.gain.setValueAtTime(0.07, now + t);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.16);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.16);
    });
  }

  grab(): void {
    this.blip(140, 0.22, "sine", 0.08, 60);
  }

  die(): void {
    this.blip(180, 0.4, "sawtooth", 0.08, -120);
  }

  perk(): void {
    this.blip(640, 0.2, "square", 0.06, 300);
  }
}
