import { Sequence, useVideoConfig } from "remotion";
import { Stage, Clip, Note, useTime } from "./Design";
export function Evidence() {
  const t = useTime(),
    { fps, durationInFrames } = useVideoConfig(),
    q = Math.round(durationInFrames / 4),
    step = Math.min(3, Math.floor((t * fps) / q));
  return (
    <Stage dark label="AG Grid + AG Charts">
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 135,
          fontSize: 110,
          fontWeight: 700,
          letterSpacing: -5,
        }}
      >
        {
          [
            "Open the evidence.",
            "See the decision.",
            "Trace the payment.",
            "Make it yours.",
          ][step]
        }
      </div>
      <Sequence from={0} durationInFrames={q} premountFor={fps}>
        <Clip
          file="ag-models"
          rate={1.2}
          box={[110, 360, 1700, 425]}
          crop={[332, 320, 890, 225]}
        />
      </Sequence>
      <Sequence from={q} durationInFrames={q} premountFor={fps}>
        <Clip
          file="ag-decisions"
          trim={3.2}
          box={[110, 340, 1700, 490]}
          crop={[215, 245, 855, 250]}
        />
      </Sequence>
      <Sequence from={q * 2} durationInFrames={q} premountFor={fps}>
        <Clip
          file="ag-paypal"
          box={[580, 300, 780, 590]}
          crop={[778, 183, 450, 340]}
        />
      </Sequence>
      <Sequence from={q * 3} premountFor={fps}>
        <Clip
          file="ag-layout"
          rate={1.2}
          box={[330, 315, 1260, 590]}
          crop={[305, 300, 830, 390]}
        />
      </Sequence>
      <Note dark>
        Recorded app interactions · authored AG Studio layouts · evaluation
        build
      </Note>
    </Stage>
  );
}
