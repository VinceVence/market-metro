import { Stage, HeroVideo, Icon, Brand, ramp, useTime, cue } from "./Design";
import { Person } from "./StoryArt";
export function Merchant() {
  const t = useTime(),
    opened = cue("market", "opened", 3),
    people = cue("market", "people", 6),
    days = cue("market", "days", 12),
    data = cue("market", "data", 15),
    who = cue("market", "who", 17),
    what = cue("market", "what", 18);
  const close = ramp(t, opened - 0.25, opened + 0.45),
    thought = ramp(t, data - 0.5, data + 0.5),
    concern = ramp(t, people, days);
  return (
    <Stage brand={false} enter={false}>
      <HeroVideo
        file="film-park"
        zoom={1 + 0.18 * ramp(t, 0.2, opened)}
        opacity={1 - close}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: close * (1 - 0.88 * thought),
        }}
      >
        <HeroVideo file="film-traffic" rate={0.78} zoom={1.04} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 125,
          rotate: "-3deg",
          opacity: 1 - ramp(t, opened - 0.4, opened + 0.15),
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "10px 20px",
            background: "#fff2d7",
            borderRadius: 13,
            fontSize: 26,
            fontWeight: 700,
            color: "#183e58",
          }}
        >
          FOR LEO, IT WAS A
        </div>
        <div
          style={{
            fontSize: 101,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -4,
            color: "#103b5b",
            textShadow: "3px 4px 0 #ffffff",
          }}
        >
          normal day.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 580,
          background: "#fff",
          borderRadius: "0 100px 100px 0",
          opacity: close * (1 - thought),
        }}
      />
      <Person
        role="merchant"
        emotion={0.75 - 1.45 * concern}
        wave={1 - ramp(t, people, people + 0.8)}
        thinking={thought}
        gaze={0.65}
        style={{
          left: 155 + 265 * thought,
          top: 410 - 60 * thought,
          width: 265 + 55 * thought,
          height: 461 + 96 * thought,
          opacity: close,
          filter: "drop-shadow(0px 9px 5px #14394b25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 205,
          top: 335,
          fontSize: 48,
          fontWeight: 700,
          color: "#153c57",
          opacity: close * (1 - ramp(t, people + 0.1, people + 0.8)),
        }}
      >
        Leo
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: thought }}>
        <svg
          width="1920"
          height="1080"
          style={{ position: "absolute", inset: 0 }}
        >
          <path
            d="M710 460Q860 300 1070 370M710 470Q1080 780 1430 650"
            stroke="#6a9bb5"
            strokeWidth="4"
            strokeDasharray="10 12"
            fill="none"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 1050,
            top: 250,
            width: 370,
            height: 285,
            background: "#fff5df",
            border: "3px solid #234b64",
            borderRadius: 28,
            boxShadow: "8px 10px 0 #23485814",
            rotate: "-3deg",
            padding: 32,
            boxSizing: "border-box",
            opacity: ramp(t, who - 0.8, who - 0.25),
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              color: "#197f99",
              marginBottom: 14,
            }}
          >
            {[0, 1, 2].map((i) => (
              <Icon key={i} kind="person" size={43} />
            ))}
          </div>
          <div
            style={{
              fontSize: 77,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: -3,
            }}
          >
            WHO?
          </div>
          <div style={{ fontSize: 34, marginTop: 12 }}>Who to reach</div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 1430,
            top: 570,
            width: 350,
            height: 270,
            background: "#def0f1",
            border: "3px solid #234b64",
            borderRadius: 28,
            boxShadow: "8px 10px 0 #23485814",
            rotate: "3deg",
            padding: 30,
            boxSizing: "border-box",
            opacity: ramp(t, what - 0.8, what - 0.25),
          }}
        >
          <Icon kind="store" size={54} color="#16758f" />
          <div
            style={{
              fontSize: 73,
              lineHeight: 1,
              fontWeight: 800,
              letterSpacing: -3,
              marginTop: 6,
            }}
          >
            WHAT?
          </div>
          <div style={{ fontSize: 32, marginTop: 10 }}>What to offer</div>
        </div>
      </div>
      <Brand opacity={ramp(t, data - 0.5, data + 0.2)} />
    </Stage>
  );
}
