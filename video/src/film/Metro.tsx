import { CanvasImage, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import plan from "../../public/data/plan.json";
import { C, ramp } from "./Design";

/** Route M: every chapter after the intro is a station on the line. */
export const STATIONS: Record<string, string> = {
  problem: "Meet",
  ontology: "Ontology",
  planner: "Plan",
  verifier: "Verify",
  shopper: "Shop",
  paypal: "Pay",
  impact: "Impact",
  ag_grid: "Trail",
};
const ids = Object.keys(STATIONS);
const LINE = [C.blue, C.cyan, C.mint];

const sceneAt = (id: string) => plan.scenes.find((s) => s.id === id)!;

/** A metro train pulls in over each chapter cut, pauses at the station, then departs. */
export const ARRIVE = 1.05, // keep in sync with scripts/score.py
  DWELL = 0.8,
  DEPART = 1.0;
function Train({ id, start }: { id: string; start: number }) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  const L = 4800,
    stop = -200,
    s = frame / fps - start / fps,
    a0 = -ARRIVE - 0.1,
    d0 = -0.1 + DWELL;
  if (s < a0 || s > d0 + DEPART) return null;
  let x: number, speed: number;
  if (s < -0.1) {
    const k = (s - a0) / ARRIVE;
    x = 1920 + (stop - 1920) * (1 - Math.pow(1 - k, 3));
    speed = 3 * Math.pow(1 - k, 2);
  } else if (s < d0) {
    const k = (s + 0.1) / DWELL;
    x = stop + Math.sin(k * Math.PI * 2) * 10 * (1 - k);
    speed = 0;
  } else {
    const k = (s - d0) / DEPART;
    x = stop + (-L - 100 - stop) * k * k * k;
    speed = 3 * k * k;
  }
  const k = speed / 3;
  const n = ids.indexOf(id) + 1;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 20 }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: -10,
          width: L,
          height: 1100,
          display: "flex",
          gap: 0,
          filter: `blur(${k * 4}px)`,
        }}
      >
        {[0, 1, 2].map((car) => (
          <div
            key={car}
            style={{
              position: "relative",
              flex: 1,
              borderRadius: car === 0 ? "260px 0 0 260px" : 0,
              borderRight: car < 2 ? "18px solid #9fb3c8" : "none",
              background: "linear-gradient(180deg,#ffffff 0%,#eef4fb 70%,#d3e0ee 100%)",
              boxShadow: "inset 0 -30px 0 #b9cadb",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 690,
                height: 64,
                background: `linear-gradient(90deg, ${LINE.join(",")})`,
              }}
            />
            {[0, 1, 2, 3].map((w) => (
              <div
                key={w}
                style={{
                  position: "absolute",
                  left: (car === 0 ? 420 : 110) + w * 330,
                  top: 220,
                  width: 260,
                  height: 380,
                  borderRadius: 34,
                  background: "linear-gradient(160deg,#0b2b4f,#123e6d 60%,#0b2b4f)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: -120 + ((w * 70 + car * 40) % 180),
                    top: -40,
                    width: 70,
                    height: 520,
                    background: "#ffffff22",
                    rotate: "18deg",
                  }}
                />
              </div>
            ))}
            {car === 1 && (
              <div
                style={{
                  position: "absolute",
                  left: 1260,
                  top: 150,
                  width: 230,
                  height: 600,
                  borderRadius: 26,
                  border: "8px solid #c8d6e4",
                  background: "#0d3158",
                }}
              />
            )}
            {car === 0 && (
              <>
                <CanvasImage
                  src={staticFile("brand/metro.svg")}
                  premountFor={fps}
                  style={{ position: "absolute", left: 330, top: 760, width: 150, height: 150 }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 420,
                    top: 90,
                    padding: "14px 34px",
                    borderRadius: 18,
                    background: "#06192d",
                    color: "#ffb84a",
                    fontFamily: "DM Sans",
                    fontWeight: 700,
                    fontSize: 64,
                    letterSpacing: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  <div style={{ fontSize: 26, letterSpacing: 8, color: "#ffd590" }}>NEXT STOP</div>
                  M · {String(n).padStart(2, "0")} {STATIONS[id].toUpperCase()}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Persistent route map: stations light up and a train dot rides between them. */
function RouteMap() {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig(),
    t = frame / fps;
  const first = sceneAt(ids[0]),
    close = sceneAt("close");
  const show =
    ramp(t, first.startFrame / fps + 1.2, first.startFrame / fps + 1.8) *
    (1 - ramp(t, close.startFrame / fps - 0.3, close.startFrame / fps + 0.2));
  if (show <= 0) return null;
  let pos = 0;
  ids.forEach((id, i) => {
    const s = sceneAt(id);
    const p = (frame - s.startFrame) / s.durationInFrames;
    if (p >= 0) pos = i + Math.min(1, p) * 0.999;
  });
  const W = 820,
    gap = W / (ids.length - 1),
    dark = ["planner", "paypal", "impact", "ag_grid"].includes(ids[Math.floor(pos)]);
  return (
    <div
      style={{
        position: "absolute",
        left: 530,
        top: 30,
        width: W + 80,
        height: 84,
        padding: "0 40px",
        borderRadius: 40,
        background: dark ? "#0a2a4dcc" : "#ffffffd9",
        border: `1px solid ${dark ? "#ffffff1c" : "#0a2d4b14"}`,
        boxShadow: "0 10px 30px #0a2d4b18",
        opacity: show,
        translate: `0px ${(1 - show) * -40}px`,
        fontFamily: "DM Sans",
        zIndex: 10,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 26,
          width: W,
          height: 6,
          borderRadius: 3,
          background: dark ? "#ffffff22" : "#dbe6f1",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 26,
          width: Math.min(W, pos * gap),
          height: 6,
          borderRadius: 3,
          background: `linear-gradient(90deg, ${LINE.join(",")})`,
        }}
      />
      {ids.map((id, i) => {
        const here = Math.floor(pos) === i,
          passed = pos >= i;
        return (
          <div
            key={id}
            style={{
              position: "absolute",
              left: 40 + i * gap - 50,
              top: 16,
              width: 100,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
            }}
          >
            <div
              style={{
                width: here ? 26 : 18,
                height: here ? 26 : 18,
                marginTop: here ? -4 : 0,
                borderRadius: 13,
                background: passed ? (dark ? "#0a2a4d" : "#fff") : dark ? "#21476f" : "#dbe6f1",
                border: `4px solid ${passed ? C.blue : "transparent"}`,
                boxSizing: "border-box",
                boxShadow: here ? `0 0 0 ${6 + Math.sin(t * 5) * 3}px #0877e533` : "none",
              }}
            />
            <div
              style={{
                fontSize: 20,
                fontWeight: here ? 700 : 600,
                letterSpacing: 0.5,
                color: here ? (dark ? "#fff" : C.ink) : dark ? "#8fb0d0" : "#8aa0b6",
                whiteSpace: "nowrap",
              }}
            >
              {STATIONS[id]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MetroOverlay() {
  return (
    <>
      <RouteMap />
      {ids.slice(1).map((id) => (
        <Train key={id} id={id} start={sceneAt(id).startFrame} />
      ))}
    </>
  );
}
