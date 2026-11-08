import { Sequence, useVideoConfig } from "remotion";
import { Stage, Icon, Clip, Note, ramp, useTime, C } from "./Design";
export function Planning() {
  const t = useTime(),
    { fps, durationInFrames } = useVideoConfig(),
    cut = durationInFrames / fps - 2.5;
  return (
    <Stage dark label="LLM + local tools">
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 145,
          fontSize: 108,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        {t < 2.8
          ? "Read the market."
          : t < 5.7
            ? "Train the models."
            : "Recommend."}
      </div>
      {t < cut && (
        <>
          <svg
            width="1920"
            height="1080"
            style={{ position: "absolute", inset: 0 }}
          >
            <path d="M460 580H1450" stroke="#3e6895" strokeWidth="6" />
            {[0, 1, 2].map((i) => (
              <circle
                key={i}
                cx={460 + ((t * 195 + i * 330) % 1000)}
                cy={580}
                r="9"
                fill={C.cyan}
              />
            ))}
          </svg>
          {[
            ["data", "28 days"],
            ["model", "LLM agent"],
            ["model", "2 model fits"],
            ["card", "Campaign"],
          ].map(([kind, name], i) => (
            <div
              key={name}
              style={{
                position: "absolute",
                left: 110 + i * 445,
                top: 430,
                width: 360,
                height: 300,
                borderRadius: 36,
                background: i === 1 ? C.blue : "#103960",
                border: "1px solid #6594c54d",
                display: "grid",
                alignContent: "center",
                justifyItems: "center",
                gap: 28,
                opacity: ramp(t, i * 0.6, i * 0.6 + 0.4),
                translate: `0px ${(1 - ramp(t, i * 0.6, i * 0.6 + 0.4)) * 45}px`,
              }}
            >
              <Icon kind={kind} size={88} color={i === 1 ? "#fff" : C.cyan} />
              <div style={{ fontSize: 36, fontWeight: 600 }}>{name}</div>
            </div>
          ))}
        </>
      )}
      <Sequence from={Math.round(cut * fps)} premountFor={fps}>
        <Clip
          file="planner-decisions"
          trim={9.2}
          box={[150, 330, 1620, 500]}
          crop={[215, 246, 853, 264]}
        />
      </Sequence>
      <Note dark>
        Recorded LLM choices · trusted tools execute · original run
      </Note>
    </Stage>
  );
}
