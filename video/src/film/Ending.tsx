import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import data from "../../public/data/case.json";
import { Stage, HeroVideo, Icon, ramp, useTime, usePop, cue, C, Burst } from "./Design";
import { Person } from "./StoryArt";
import { CityStreet } from "./City";

export function Ending() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    pop = usePop(),
    questions = cue("close", "guess", 1.2),
    tested = cue("close", "tested", 3),
    market = cue("close", "market", 4.6),
    lockup = ramp(t, market - 0.5, market),
    hop = (o: number) => -Math.abs(Math.sin(t * 3.2 + o)) * 26;
  const answers = [
    { q: "WHO?", a: `Shopper ${data.shopper.name}`, sub: `Back after ${data.shopper.daysSincePurchase} days`, icon: "person", x: 1080, y: 230, at: questions },
    { q: "WHAT?", a: data.shopper.product, sub: `$${data.shopper.grossCents / 100} · delivered next day`, icon: "tag", x: 1290, y: 560, at: questions + 0.5 },
  ];
  return (
    <Stage brand={false}>
      {/* Callback: Leo's two questions, answered */}
      <div style={{ position: "absolute", inset: 0, opacity: 1 - lockup }}>
        <CityStreet />
        <Person role="merchant" happy wave={ramp(t, tested, tested + 0.5)} gaze={0.6} style={{ left: 680, top: 355 + hop(0) * ramp(t, tested, tested + 0.3), width: 330, height: 574 }} />
        {answers.map((c) => {
          const p = pop(c.at - 0.3, 10),
            ok = pop(tested + (c.q === "WHAT?" ? 0.3 : 0), 8);
          return (
            <div
              key={c.q}
              style={{
                position: "absolute",
                left: c.x,
                top: c.y,
                width: 520,
                padding: "30px 34px",
                borderRadius: 26,
                background: "#fff",
                border: `3px solid ${ok > 0.5 ? C.mint : "#d9e4ec"}`,
                boxShadow: "0 20px 55px #0a2d4b1c",
                scale: p,
                rotate: `${(1 - p) * -8 + Math.sin(t * 1.4 + c.x) * 1}deg`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Icon kind={c.icon} size={46} color={C.blue} />
                <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: -2, color: C.ink }}>{c.q}</div>
              </div>
              <div style={{ fontSize: 40, fontWeight: 700, marginTop: 14, color: "#11735f", opacity: ok }}>{c.a}</div>
              <div style={{ fontSize: 26, color: C.muted, marginTop: 4, opacity: ok }}>{c.sub}</div>
              <div
                style={{
                  position: "absolute",
                  right: -22,
                  top: -22,
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  background: C.mint,
                  display: "grid",
                  placeItems: "center",
                  scale: ok,
                  boxShadow: "0 10px 24px #22b59766",
                }}
              >
                <Icon kind="check" size={40} color="#fff" />
              </div>
            </div>
          );
        })}
        <Burst at={tested + 0.3} x={1340} y={470} spread={300} count={30} />
      </div>

      {/* Logo lockup */}
      <div style={{ position: "absolute", inset: 0, opacity: lockup }}>
        <HeroVideo file="film-return" zoom={1.12} opacity={0.14} />
        <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
          <path
            d="M-20 880 H420 L620 680 H1300 L1500 880 H1940"
            pathLength={1}
            stroke="url(#route)"
            strokeWidth="16"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1 1"
            strokeDashoffset={1 - ramp(t, market, market + 1.6)}
          />
          <defs>
            <linearGradient id="route">
              <stop stopColor={C.blue} />
              <stop offset=".5" stopColor={C.cyan} />
              <stop offset="1" stopColor={C.mint} />
            </linearGradient>
          </defs>
        </svg>
        <Person role="merchant" happy wave={1} style={{ left: 140, top: 520 + hop(0), width: 200, height: 348 }} />
        <Person happy wave={1} style={{ left: 1580, top: 520 + hop(1.2), width: 200, height: 348 }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            marginTop: -60,
          }}
        >
          <CanvasImage
            src={staticFile("brand/metro.svg")}
            premountFor={fps}
            style={{ width: 120, height: 120, scale: pop(market - 0.3, 8), rotate: `${(1 - pop(market - 0.3, 8)) * -200}deg` }}
          />
          <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: -8, display: "flex" }}>
            {"Market Metro".split("").map((ch, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  opacity: Math.min(1, pop(market - 0.2 + i * 0.035) * 1.5),
                  translate: `0px ${(1 - pop(market - 0.2 + i * 0.035, 10)) * 90}px`,
                  ...(i > 6
                    ? { background: `linear-gradient(90deg, ${C.blue}, ${C.mint})`, WebkitBackgroundClip: "text", color: "transparent" }
                    : {}),
                }}
              >
                {ch}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 54, opacity: ramp(t, market + 1, market + 1.4), translate: `0px ${(1 - ramp(t, market + 1, market + 1.5)) * 20}px` }}>
            Agentic commerce that learns.
          </div>
          <div style={{ display: "flex", gap: 30, marginTop: 26 }}>
            {[
              ["data", "Learns", "learns"],
              ["check", "Tests its ideas", "tests"],
              ["grid", "Shows its work", "shows"],
            ].map(([kind, label, word]) => {
              const at = cue("close", "learns", 7) - 0.25 + ["learns", "tests", "shows"].indexOf(word) * 0.35;
              return (
                <div
                  key={kind}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 30px 16px 20px",
                    borderRadius: 40,
                    background: "#fff",
                    boxShadow: "0 16px 40px #0877e526",
                    fontSize: 32,
                    fontWeight: 700,
                    color: C.ink,
                    scale: pop(at, 8),
                  }}
                >
                  <Icon kind={kind} size={40} color={C.blue} />
                  {label}
                </div>
              );
            })}
          </div>
        </div>
        <Burst at={market + 0.2} x={960} y={420} spread={560} count={44} />
      </div>
    </Stage>
  );
}
