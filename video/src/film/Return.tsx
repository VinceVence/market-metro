import {
  Stage,
  HeroVideo,
  Icon,
  ProductTable,
  ramp,
  useTime,
  cue,
  C,
} from "./Design";
import { Person } from "./StoryArt";
export function Return() {
  const t = useTime(),
    paid = cue("shopper", "buy", 4),
    delivered = cue("shopper", "arrives", 7);
  return (
    <Stage>
      <HeroVideo
        file="film-return"
        zoom={1.14 + 0.06 * ramp(t, 0, 12)}
        x={-200}
        opacity={0.3}
      />
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 165,
          fontSize: 50,
          color: C.ink,
          fontWeight: 600,
        }}
      >
        The recommendation reaches them.
      </div>
      <Person
        emotion={-0.15 + 1.15 * ramp(t, paid, paid + 0.7)}
        wave={ramp(t, delivered, delivered + 0.7)}
        thinking={0.25 * (1 - ramp(t, paid, paid + 0.5))}
        gaze={0.6}
        style={{ left: 360, top: 370, width: 290, height: 504 }}
      />
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 580,
          width: 390,
          borderTop: "5px dashed #70a8d3",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1150,
          top: 140,
          width: 590,
          height: 750,
          background: "#f8fbff",
          border: "10px solid #0d2f55",
          borderRadius: 58,
          overflow: "hidden",
          boxShadow: "0 30px 80px #09284e22",
          translate: `${(1 - ramp(t, 0, 0.7)) * 70}px 0px`,
        }}
      >
        <div
          style={{
            width: 115,
            height: 18,
            borderRadius: 12,
            background: "#0d2f55",
            margin: "22px auto",
          }}
        />
        <div
          style={{
            fontSize: 26,
            color: C.blue,
            padding: "12px 38px",
            fontWeight: 600,
          }}
        >
          FOR YOU
        </div>
        <div style={{ position: "absolute", left: -65, top: 50, scale: 0.73 }}>
          <ProductTable />
        </div>
        <div style={{ position: "absolute", left: 38, right: 38, top: 470 }}>
          <div style={{ fontSize: 38, fontWeight: 600 }}>Mobile Side Table</div>
          <div style={{ fontSize: 76, fontWeight: 700, marginTop: 4 }}>$96</div>
          <div style={{ height: 76, marginTop: 15, position: "relative" }}>
            {[
              ["Recommended", C.blue, 0, paid],
              ["Purchased", "#128e72", paid, delivered],
              ["Delivered", "#128e72", delivered, 999],
            ].map(([label, color, start, end]) => (
              <div
                key={String(label)}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: String(color),
                  color: "#fff",
                  borderRadius: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 16,
                  fontSize: 32,
                  fontWeight: 600,
                  opacity:
                    (Number(start) === 0
                      ? 1
                      : ramp(t, Number(start), Number(start) + 0.4)) *
                    (1 - ramp(t, Number(end), Number(end) + 0.4)),
                }}
              >
                {Number(start) > 0 && (
                  <Icon
                    kind={label === "Delivered" ? "truck" : "check"}
                    size={36}
                  />
                )}{" "}
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 410,
          display: "flex",
          gap: 15,
          alignItems: "center",
          fontSize: 46,
          color: "#148d73",
          opacity: ramp(t, paid, paid + 0.4),
          translate: `0px ${-35 * ramp(t, paid, paid + 1)}px`,
        }}
      >
        <Icon kind="check" size={48} />
        $96 purchase
      </div>
    </Stage>
  );
}
