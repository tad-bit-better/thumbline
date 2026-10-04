// Minimal fake of the Web Audio pieces the player uses; records what it's asked to do.

export class FakeParam {
  events: Array<[string, number, number]> = [];
  constructor(public value: number) {}
  setValueAtTime(v: number, t: number) {
    this.events.push(['set', v, t]);
    this.value = v;
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.events.push(['target', v, t]);
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  connected: unknown[] = [];
  connect(node: unknown) {
    this.connected.push(node);
    return node;
  }
  disconnect() {
    this.connected = [];
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}

export class FakePanner extends FakeNode {
  pan = new FakeParam(0);
}

export class FakeConvolver extends FakeNode {
  buffer: FakeBuffer | null = null;
}

export class FakeBuffer {
  private data: Float32Array[];
  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number,
  ) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData(c: number) {
    return this.data[c];
  }
  copyToChannel(source: Float32Array, c: number) {
    this.data[c].set(source);
  }
}

export class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  started?: { when: number; offset: number };
  stopAt?: number;
  onended: (() => void) | null = null;
  start(when = 0, offset = 0) {
    this.started = { when, offset };
  }
  stop(when = 0) {
    this.stopAt = this.stopAt === undefined ? when : Math.min(this.stopAt, when);
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate: number;
  state: 'running' | 'suspended' | 'closed' = 'running';
  baseLatency = 0;
  outputLatency = 0;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  panners: FakePanner[] = [];
  convolvers: FakeConvolver[] = [];
  constructor(sampleRate = 8000) {
    this.sampleRate = sampleRate;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  createStereoPanner() {
    const p = new FakePanner();
    this.panners.push(p);
    return p;
  }
  createConvolver() {
    const c = new FakeConvolver();
    this.convolvers.push(c);
    return c;
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return new FakeBuffer(channels, length, sampleRate);
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  async resume() {
    this.state = 'running';
  }
  async close() {
    this.state = 'closed';
  }
}
