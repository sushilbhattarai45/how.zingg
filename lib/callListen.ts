/**
 * Play Vapi Call Listen audio in the browser.
 * Stream format (docs.vapi.ai/calls/call-listen): first JSON message is
 * { type: "start", encoding: "linear16", sampleRate, channels }, then binary PCM frames.
 * Listen-only — no microphone.
 */

export type ListenState = 'idle' | 'connecting' | 'listening' | 'error' | 'ended';

export type CallListenHandle = {
  stop: () => void;
  setMuted: (muted: boolean) => void;
};

type StartMsg = {
  type: string;
  encoding?: string;
  sampleRate?: number;
  channels?: number;
};

/**
 * Connect to monitor.listenUrl and play PCM through Web Audio.
 * Returns a handle, or throws if the socket fails to open.
 */
export function startCallListen(
  listenUrl: string,
  onState: (s: ListenState, detail?: string) => void,
): CallListenHandle {
  const ws = new WebSocket(listenUrl);
  ws.binaryType = 'arraybuffer';

  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let sampleRate = 16000;
  let channels = 2;
  let nextTime = 0;
  let closed = false;

  const stop = () => {
    if (closed) return;
    closed = true;
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    void ctx?.close();
    ctx = null;
    onState('ended');
  };

  const setMuted = (muted: boolean) => {
    if (gain) gain.gain.value = muted ? 0 : 1;
  };

  ws.onopen = () => onState('connecting');

  ws.onerror = () => {
    onState('error', 'Live listen WebSocket failed');
    stop();
  };

  ws.onclose = () => {
    if (!closed) {
      closed = true;
      void ctx?.close();
      onState('ended');
    }
  };

  ws.onmessage = async (ev) => {
    if (closed) return;
    if (typeof ev.data === 'string') {
      let msg: StartMsg;
      try {
        msg = JSON.parse(ev.data) as StartMsg;
      } catch {
        return;
      }
      if (msg.type === 'start') {
        sampleRate = msg.sampleRate ?? 16000;
        channels = msg.channels ?? 2;
        if (!ctx) {
          ctx = new AudioContext({ sampleRate });
          gain = ctx.createGain();
          gain.connect(ctx.destination);
          nextTime = ctx.currentTime + 0.05;
        }
        if (ctx.state === 'suspended') await ctx.resume();
        onState('listening');
      }
      return;
    }

    if (!ctx || !gain) return;
    const pcm = new Int16Array(ev.data as ArrayBuffer);
    if (!pcm.length) return;

    const frameCount = Math.floor(pcm.length / channels);
    if (frameCount <= 0) return;

    const buffer = ctx.createBuffer(channels, frameCount, sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < frameCount; i++) {
        data[i] = (pcm[i * channels + ch] ?? 0) / 32768;
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    const startAt = Math.max(ctx.currentTime + 0.02, nextTime);
    src.start(startAt);
    nextTime = startAt + buffer.duration;
  };

  return { stop, setMuted };
}
