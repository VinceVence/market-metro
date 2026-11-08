import { Sequence, useVideoConfig } from "remotion";
import { Stage, Icon, Clip, Note, ramp, useTime, cue, C } from "./Design";
import { Person } from "./StoryArt";
export function Meaning() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    hold = cue("ontology", "holds", 8);
  return (
    <Stage label="The ontology connects meaning">
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 155,
          fontSize: 78,
          fontWeight: 650,
        }}
      >
        Connect the evidence.
      </div>
      <Person style={{ left: 115, top: 450, width: 200, height: 348 }} />
      <div style={{ opacity: 1 - ramp(t, hold, hold + 0.4) }}>
        <svg
          width="1920"
          height="1080"
          style={{ position: "absolute", inset: 0 }}
        >
          <path
            d="M320 620H590M790 620H1100M1300 620H1570"
            stroke="#a9c7e2"
            strokeWidth="6"
          />
          <path
            d="M1680 520V365h-180"
            fill="none"
            stroke="#a9c7e2"
            strokeWidth="5"
          />
        </svg>
        {[
          ["data", "Product"],
          ["card", "Checkout"],
          ["store", "Merchant orders"],
        ].map(([kind, name], i) => (
          <div
            key={name}
            style={{
              position: "absolute",
              left: 500 + i * 500,
              top: 440,
              width: 310,
              height: 310,
              borderRadius: 30,
              background: i === 1 ? C.blue : "#fff",
              color: i === 1 ? "#fff" : C.ink,
              boxShadow: "0 22px 65px #12345614",
              display: "flex",
              flexDirection: "column",
              gap: 30,
              alignItems: "center",
              justifyContent: "center",
              opacity: ramp(t, 0.5 + i * 0.5, 1 + i * 0.5),
            }}
          >
            <Icon kind={kind} size={90} />
            <div style={{ fontSize: 34, fontWeight: 600 }}>{name}</div>
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            left: 1155,
            top: 307,
            fontSize: 34,
            color: C.blue,
            opacity: ramp(t, 4.5, 5),
          }}
        >
          One parent purchase
        </div>
      </div>
      <Sequence from={Math.round(hold * fps)} premountFor={fps}>
        <div style={{ opacity: ramp(t, hold, hold + 0.4) }}>
          <Clip
            file="ontology"
            trim={6}
            box={[650, 330, 1140, 570]}
            crop={[270, 100, 740, 370]}
          />
          <div
            style={{
              position: "absolute",
              left: 110,
              top: 320,
              color: "#a66d19",
              fontSize: 43,
              fontWeight: 600,
            }}
          >
            Unclear link → hold
          </div>
        </div>
      </Sequence>
      <Note>
        Illustrated links · recorded ambiguity check · each checkout counted
        once
      </Note>
    </Stage>
  );
}
