import { Stage, HeroVideo, Icon, ramp, useTime, cue, C } from "./Design";
import { Person, Store } from "./StoryArt";
export function Merchant() {
  const t = useTime(),
    meet = cue("market", "meet", 3.5),
    days = cue("market", "days", 6),
    worry = cue("market", "struggled", 6.5),
    records = cue("market", "checks", 8);
  const flight = ramp(t, 0.5, meet + 0.25),
    zoom = 1 + 2.2 * flight,
    close = ramp(t, meet - 0.12, meet + 0.28),
    story = ramp(t, meet + 0.4, meet + 1.3);
  const concerned = ramp(t, worry, worry + 1),
    thinking = ramp(t, records, records + 0.8);
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
            opacity: 1 - 0.4 * concerned,
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
            opacity: ramp(t, days - 0.3, days + 0.3),
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
        {[
          ["data", "sales", 1100, 410],
          ["store", "product", 1120, 200],
          ["card", "payments", 1700, 500],
        ].map(([kind, word, x, y]) => (
          <div
            key={String(kind)}
            style={{
              position: "absolute",
              left: Number(x),
              top: Number(y),
              width: 130,
              height: 130,
              borderRadius: 24,
              background: "#fff",
              boxShadow: "0 15px 45px #12345615",
              display: "grid",
              placeItems: "center",
              opacity: ramp(
                t,
                cue("market", String(word), records) - 0.2,
                cue("market", String(word), records) + 0.4,
              ),
              rotate: `${Math.sin(t * 0.7 + Number(x)) * 3}deg`,
            }}
          >
            <Icon kind={String(kind)} size={62} color={C.blue} />
          </div>
        ))}
      </div>
    </Stage>
  );
}
