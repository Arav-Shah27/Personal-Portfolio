/* ==========================================================================
   Thunder, made in the browser: no audio files. Off until you switch it on
   (and remembered after that). A strike gets a crack, then a long rumble a
   moment later, the way thunder trails lightning.
   ========================================================================== */
const KEY = "thunder";

export function startSound() {
  const button = document.querySelector(".sound");
  if (!button) return;
  let on = false, ctx = null, master = null, noise = null;

  try { on = localStorage.getItem(KEY) === "on"; } catch {}
  /* even when it was left on, the browser needs a tap before it plays sound */
  const sync = () => {
    button.setAttribute("aria-pressed", String(on));
  };
  sync();

  function boot() {
    if (ctx) return ctx.resume();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    /* four seconds of brown noise to cut every rumble from */
    const len = ctx.sampleRate * 4;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
  }

  function thunder({ near = false } = {}) {
    if (!on || !ctx || ctx.state !== "running") return;
    const t0 = ctx.currentTime + (near ? 0.05 : 0.35 + Math.random() * 0.6);
    const loud = near ? 1 : 0.55 + Math.random() * 0.3;

    /* the crack */
    const crack = ctx.createBufferSource();
    crack.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 900;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0, t0);
    cg.gain.linearRampToValueAtTime(0.5 * loud, t0 + 0.01);
    cg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
    crack.connect(hp).connect(cg).connect(master);
    crack.start(t0, Math.random() * 2, 0.4);

    /* the rumble, rolling */
    const rumble = ctx.createBufferSource();
    rumble.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(420, t0);
    lp.frequency.exponentialRampToValueAtTime(90, t0 + 3.2);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0, t0);
    rg.gain.linearRampToValueAtTime(0.9 * loud, t0 + 0.12);
    for (let k = 1; k < 6; k++) rg.gain.linearRampToValueAtTime((0.25 + Math.random() * 0.55) * loud * (1 - k / 7), t0 + 0.12 + k * 0.45);
    rg.gain.exponentialRampToValueAtTime(0.001, t0 + 3.6);
    rumble.connect(lp).connect(rg).connect(master);
    rumble.start(t0, Math.random() * 0.5, 3.8);
  }

  button.addEventListener("click", () => {
    on = !on;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
    sync();
    if (on) { boot(); thunder({ near: true }); }
  });
  /* if it was left on, wake the audio on the first tap anywhere */
  if (on) window.addEventListener("pointerdown", () => boot(), { once: true });

  window.addEventListener("storm:strike", (e) => thunder(e.detail));
}
