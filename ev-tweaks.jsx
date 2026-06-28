/* ───────── 长明山谷 · Tweaks ───────── */
const { useEffect } = React;

const EV_DEFAULTS = /*EDITMODE-BEGIN*/{
  "brightness": 1.0,
  "glow": 1.0,
  "fireDistance": 0.85,
  "fireVolume": 0.7
}/*EDITMODE-END*/;

function EvTweaks() {
  const [t, setTweak] = useTweaks(EV_DEFAULTS);

  // push values into the canvas engine whenever they change
  useEffect(() => { window.evSetBright   && window.evSetBright(t.brightness); },   [t.brightness]);
  useEffect(() => { window.evSetGlow     && window.evSetGlow(t.glow); },           [t.glow]);
  useEffect(() => { window.evSetFireDist && window.evSetFireDist(t.fireDistance); }, [t.fireDistance]);
  useEffect(() => { window.evSetFireVol  && window.evSetFireVol(t.fireVolume); },   [t.fireVolume]);

  return (
    <TweaksPanel title="长明山谷">
      <TweakSection label="山谷" />
      <TweakSlider label="整体亮度" value={t.brightness} min={0.6} max={1.5} step={0.05}
                   onChange={(v) => setTweak('brightness', v)} />
      <TweakSlider label="地平线暖光" value={t.glow} min={0} max={2} step={0.1}
                   onChange={(v) => setTweak('glow', v)} />

      <TweakSection label="篝火声" />
      <TweakSlider label="远近 (近 → 远)" value={t.fireDistance} min={0} max={1} step={0.05}
                   onChange={(v) => setTweak('fireDistance', v)} />
      <TweakSlider label="音量" value={t.fireVolume} min={0} max={1} step={0.05}
                   onChange={(v) => setTweak('fireVolume', v)} />
    </TweaksPanel>
  );
}

const evRoot = document.getElementById('ev-tweaks-root');
if (evRoot) ReactDOM.createRoot(evRoot).render(<EvTweaks />);
