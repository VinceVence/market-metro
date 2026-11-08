import { Stage, HeroVideo, Icon, ramp, useTime, cue, C, Brand } from "./Design";
import { Person, Store } from "./StoryArt";
export function Merchant() {
  const t = useTime(),
    meet = 3.55,
    days = cue("market", "days", 6),
    worry = cue("market", "people", 6),
    records = cue("market", "data", 15),
    who = cue("market", "who", 17),
    what = cue("market", "what", 18);
  const flight = ramp(t, 0.5, meet + 0.25),
    zoom = 1 + 2.2 * flight,
    close = ramp(t, meet - 0.12, meet + 0.28),
    story = ramp(t, meet + 0.4, meet + 1.3);
  const concerned = ramp(t, worry, worry + 1),
    thinking = ramp(t, records, records + 0.8),
    thought = thinking;
  return (
    <Stage brand={false} enter={false}>
      <HeroVideo
        file="film-world"
        zoom={zoom}
        x={310 * zoom * flight}
        y={140 * zoom * flight}
        opacity={(1 - close) * (1 - story)}
      />
      <HeroVideo
        file="film-shop"
        zoom={1.15 + 0.04 * ramp(t, meet, meet + 2)}
        x={-23}
        y={184}
        opacity={close * (1 - story)}
      />
      <div style={{ position: "absolute", inset: 0, opacity: story }}>
        <HeroVideo file="film-world" zoom={1.04} opacity={0.08} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 884,
            height: 200,
            background: "#dce8f3",
          }}
        />
        <Store style={{ left: 40, top: 220, width: 1050, height: 758 }} />
        <Person
          role="merchant"
          emotion={0.65 - 1.3 * concerned}
          wave={1 - concerned}
          thinking={thinking}
          gaze={0.4 + thinking * 0.4}
          style={{ left: 680, top: 355, width: 330, height: 574 }}
        />
        <div
          style={{
            position: "absolute",
            left: 810,
            top: 300,
            fontSize: 48,
            fontWeight: 650,
            color: C.ink,
            opacity: 1 - ramp(t, days + 2.3, days + 2.9),
          }}
        >
          Leo
        </div>
        <Person
          emotion={-0.15}
          gaze={-0.6}
          thinking={0.25}
          style={{
            left: 1370,
            top: 520,
            width: 225,
            height: 391,
            opacity: (1 - 0.4 * concerned) * (1 - thinking),
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 1375,
            top: 210,
            width: 300,
            height: 260,
            borderRadius: 30,
            background: "#fff",
            boxShadow: "0 20px 65px #183c5b15",
            opacity: ramp(t, days - 0.3, days + 0.3) * (1 - thinking),
          }}
        >
          <div
            style={{
              height: 50,
              background: C.blue,
              borderRadius: "30px 30px 0 0",
            }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 13,
              padding: 24,
            }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                style={{
                  height: 34,
                  borderRadius: 6,
                  background: "#e1edf7",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: C.blue,
                    opacity: ramp(t, days + i * 0.25, days + i * 0.25 + 0.3),
                  }}
                />
              </div>
            ))}
          </div>
        </div>
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
      <Brand opacity={ramp(t, records - 0.5, records + 0.2)} />
    </Stage>
  );
}
