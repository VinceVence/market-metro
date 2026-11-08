import { CanvasImage, staticFile, useVideoConfig } from "remotion";
import { Stage, HeroVideo, Icon, ramp, useTime, cue, Brand } from "./Design";
import { Person } from "./StoryArt";
export function Quiet() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    intro = cue("problem", "meet", 3),
    map = cue("problem", "ontology", 5),
    reveal = ramp(t, intro, intro + 0.85);
  return (
    <Stage brand={false}>
      <HeroVideo
        file="film-traffic"
        zoom={1.04}
        opacity={0.12 * (1 - reveal)}
      />
      <Person
        role="merchant"
        emotion={-0.7 + 1.2 * reveal}
        thinking={1 - 0.8 * reveal}
        gaze={0.7}
        style={{
          left: 420 - 230 * reveal,
          top: 350 + 30 * reveal,
          width: 320,
          height: 557,
          filter: "drop-shadow(0px 9px 5px #14394b20)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1040,
          top: 235,
          width: 730,
          padding: "42px 45px",
          boxSizing: "border-box",
          borderRadius: "38px 38px 38px 6px",
          background: "#fff4da",
          border: "3px solid #214a65",
          boxShadow: "9px 12px 0 #24465716",
          rotate: "-2deg",
          opacity: 1 - reveal,
        }}
      >
        <div
          style={{
            fontSize: 70,
            lineHeight: 1.15,
            fontWeight: 750,
            letterSpacing: -2,
          }}
        >
          Could AI do
          <br />
          this for Leo?
        </div>
        <svg width="380" height="22" style={{ marginTop: 18 }}>
          <path
            d="M3 12Q180 -6 375 11"
            stroke="#edaa75"
            strokeWidth="11"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          left: 795,
          top: 175,
          display: "flex",
          alignItems: "center",
          gap: 24,
          opacity: reveal,
          translate: `0px ${(1 - reveal) * 40}px`,
        }}
      >
        <CanvasImage
          src={staticFile("brand/metro.svg")}
          premountFor={fps}
          style={{ width: 112, height: 112 }}
        />
        <div
          style={{
            fontSize: 91,
            fontWeight: 750,
            letterSpacing: -4,
            color: "#173d57",
          }}
        >
          Market Metro
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: reveal }}>
        <svg
          width="1920"
          height="1080"
          style={{ position: "absolute", inset: 0 }}
        >
          <path
            d="M1260 480V555M920 690H1125M1395 690H1600"
            stroke="#9fc3d7"
            strokeWidth="6"
          />
          {[0, 1].map((i) => (
            <circle
              key={i}
              cx={920 + ((t * 95 + i * 330) % 680)}
              cy="690"
              r="8"
              fill="#dfb575"
            />
          ))}
        </svg>
        <div
          style={{
            position: "absolute",
            left: 1125,
            top: 555,
            width: 270,
            height: 270,
            borderRadius: 135,
            background: "#087fba",
            color: "#fff",
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 16,
            border: "4px solid #b7e1e5",
          }}
        >
          <Icon kind="model" size={75} />
          <div
            style={{
              fontSize: 42,
              fontWeight: 650,
              opacity: ramp(t, map - 0.2, map + 0.3),
            }}
          >
            Ontology
          </div>
        </div>
        {[
          ["store", "Products", 1165, 320],
          ["person", "Shoppers", 745, 595],
        ].map(([icon, label, x, y]) => (
          <div
            key={String(label)}
            style={{
              position: "absolute",
              left: Number(x),
              top: Number(y),
              width: 195,
              height: 195,
              borderRadius: 28,
              background: "#f5f9fc",
              border: "1px solid #c9dce8",
              color: "#194056",
              display: "grid",
              alignContent: "center",
              justifyItems: "center",
              gap: 18,
            }}
          >
            <Icon kind={String(icon)} size={65} color="#147e9c" />
            <div style={{ fontSize: 30, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            left: 1580,
            top: 595,
            width: 220,
            height: 195,
            borderRadius: 28,
            background: "#f5f9fc",
            border: "1px solid #c9dce8",
            color: "#194056",
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 18,
          }}
        >
          <CanvasImage
            src={staticFile("brand/paypal.svg")}
            premountFor={fps}
            style={{ width: 49, height: 58 }}
          />
          <div style={{ fontSize: 30, fontWeight: 600 }}>Payments</div>
        </div>
      </div>
      <Brand />
    </Stage>
  );
}
