import { Sequence, useVideoConfig } from "remotion";
import data from "../../public/data/case.json";
import { Stage, Icon, Clip, ramp, useTime, usePop, cue, C, Kicker, Headline, Pulse } from "./Design";

export function Planning() {
  const t = useTime(),
    pop = usePop(),
    { fps } = useVideoConfig();
  const studies = cue("planner", "studies", 2.9),
    demand = cue("planner", "demand", 3.4),
    stock = cue("planner", "stock", 4.6),
    history = cue("planner", "tools", 3.8),
    train = cue("planner", "train", 8.9),
    every = cue("planner", "models", 5.2) + 0.5,
    checkpoint = cue("planner", "models", 5.2) + 1.6;
  const steps = [
    { icon: "eye", name: "Analyze", sub: "Demand + available stock", at: studies },
    { icon: "clock", name: `${data.decision.window}-day history`, sub: "Chosen training window", at: history },
    { icon: "model", name: "Train 2 models", sub: "Two candidates, local tools", at: train },
    { icon: "check", name: "Checkpoints", sub: "Every decision is saved", at: every },
  ];
  const app = ramp(t, every - 0.2, every + 0.4);
  const inputs = [
    { label: "Demand", icon: "heart", at: demand, angle: -0.9 },
    { label: "Stock", icon: "store", at: stock, angle: 0.15 },
    { label: `${data.decision.window} days`, icon: "clock", at: history, angle: 1.2 },
  ];
  return (
    <Stage dark>
      <Kicker n="03" label="Planner agent" dark />
      <Headline text="From insight to action." accent={["action"]} top={160} size={78} dark />

      {/* Agent core */}
      <div style={{ position: "absolute", left: 360, top: 640, scale: pop(1.0, 10) }}>
        {[260, 340, 420].map((r, i) => (
          <div
            key={r}
            style={{
              position: "absolute",
              left: -r / 2,
              top: -r / 2,
              width: r,
              height: r,
              borderRadius: "50%",
              border: `2px dashed ${i === 1 ? C.mint : C.cyan}55`,
              rotate: `${t * (i % 2 ? -24 : 18)}deg`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: -100,
            top: -100,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, #8fdcff, ${C.blue} 55%, #0a3e7a)`,
            boxShadow: `0 0 ${70 + Math.sin(t * 4) * 20}px #2e9bff99`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div style={{ rotate: `${Math.sin(t * 2) * 8}deg` }}>
            <Icon kind="model" size={92} color="#fff" />
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: -150,
            top: 230,
            width: 300,
            textAlign: "center",
            fontSize: 30,
            fontWeight: 700,
            color: "#fff",
          }}
        >
          LLM planner
        </div>
        {inputs.map((inp) => {
          const fly = ramp(t, inp.at + 1.2, inp.at + 1.9),
            appear = pop(inp.at - 0.2, 10),
            r = 230 * (1 - fly) + 20;
          return (
            <div
              key={inp.label}
              style={{
                position: "absolute",
                left: Math.cos(inp.angle + t * 0.3) * r - 85,
                top: Math.sin(inp.angle + t * 0.3) * r - 30,
                width: 170,
                height: 60,
                borderRadius: 30,
                background: "#123f6d",
                border: `2px solid ${C.cyan}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                fontSize: 24,
                fontWeight: 650,
                scale: appear * (1 - 0.7 * fly),
                opacity: 1 - fly,
              }}
            >
              <Icon kind={inp.icon} size={28} color={C.cyan} />
              {inp.label}
            </div>
          );
        })}
      </div>
      {inputs.map((inp) => (
        <Pulse key={inp.label} at={inp.at + 1.85} x={360} y={640} color={C.cyan} size={300} />
      ))}

      {/* Route of steps */}
      <div style={{ position: "absolute", inset: 0, opacity: 1 - app }}>
        <div
          style={{
            position: "absolute",
            left: 905,
            top: 360,
            width: 10,
            height: 560,
            borderRadius: 5,
            background: "#21476f",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 905,
            top: 360,
            width: 10,
            height: 560 * ramp(t, studies, every),
            borderRadius: 5,
            background: `linear-gradient(180deg, ${C.blue}, ${C.cyan}, ${C.mint})`,
          }}
        />
        {steps.map((s, i) => {
          const p = pop(s.at - 0.2, 10),
            on = t > s.at - 0.2;
          return (
            <div
              key={s.name}
              style={{
                position: "absolute",
                left: 870,
                top: 330 + i * 175,
                display: "flex",
                alignItems: "center",
                gap: 34,
                opacity: 0.3 + 0.7 * Math.min(1, p),
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  background: on ? C.blue : "#123f6d",
                  border: `6px solid ${on ? "#fff" : "#21476f"}`,
                  boxSizing: "border-box",
                  display: "grid",
                  placeItems: "center",
                  scale: 0.8 + 0.2 * p,
                  boxShadow: on ? "0 0 40px #2e9bff88" : "none",
                }}
              >
                <Icon kind={s.icon} size={38} color="#fff" />
              </div>
              <div style={{ translate: `${(1 - p) * 40}px 0px` }}>
                <div style={{ fontSize: 44, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 26, color: "#9fc5e9", marginTop: 4 }}>{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real app: the decision journey */}
      <Sequence from={Math.round((every - 0.2) * fps)} premountFor={fps}>
        <Clip
          file="planner-decisions"
          trim={4}
          box={[800, 300, 1010, 550]}
          crop={[280, 170, 1000, 520]}
          label="Market Metro · agent decisions"
        />
      </Sequence>
      <div
        style={{
          position: "absolute",
          left: 800,
          top: 872,
          display: "flex",
          gap: 18,
        }}
      >
        {[
          [`${data.decision.decisions} LLM decisions`, every + 0.6],
          [`${data.decision.window}-day window`, every + 0.9],
          [`$${data.decision.reviewCostUSD.toFixed(3)} AI review cost`, checkpoint - 0.3],
        ].map(([label, at]) => (
          <div
            key={String(label)}
            style={{
              padding: "12px 24px",
              borderRadius: 30,
              background: "#ffffff14",
              border: `2px solid ${C.cyan}66`,
              fontSize: 26,
              fontWeight: 650,
              color: "#dff4ff",
              scale: pop(Number(at), 9),
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </Stage>
  );
}
