import { Stage, Icon, ramp, useTime, cue, C } from "./Design";
import { Person } from "./StoryArt";
export function Planning() {
  const t = useTime();
  const points = [
    0,
    cue("planner", "agent", 1),
    cue("planner", "train", 7),
    cue("planner", "campaign", 9),
  ];
  return (
    <Stage dark>
      <Person
        style={{ left: 90, top: 470, width: 185, height: 322, opacity: 0.85 }}
      />
      <div
        style={{
          position: "absolute",
          left: 365,
          top: 175,
          fontSize: 76,
          fontWeight: 650,
        }}
      >
        From insight to action.
      </div>
      <svg
        width="1920"
        height="1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <path d="M290 630H1740" stroke="#416c99" strokeWidth="5" />
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={290 + ((t * 140 + i * 450) % 1450)}
            cy={630}
            r="8"
            fill={C.cyan}
          />
        ))}
      </svg>
      {[
        ["data", "28-day history"],
        ["model", "LLM agent"],
        ["model", "2 model fits"],
        ["card", "Campaign"],
      ].map(([kind, name], i) => (
        <div
          key={name}
          style={{
            position: "absolute",
            left: 360 + i * 370,
            top: 440,
            width: 305,
            height: 310,
            borderRadius: 32,
            background: i === 1 ? C.blue : "#123f6d",
            border: "1px solid #739bc54d",
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 28,
            opacity: 0.25 + 0.75 * ramp(t, points[i] - 0.4, points[i] + 0.2),
            translate: `0px ${(1 - ramp(t, points[i] - 0.4, points[i] + 0.2)) * 20}px`,
          }}
        >
          <Icon kind={kind} size={82} color={C.cyan} />
          <div style={{ fontSize: 31, fontWeight: 600 }}>{name}</div>
        </div>
      ))}
    </Stage>
  );
}
