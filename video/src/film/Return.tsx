import { Sequence, useVideoConfig } from "remotion";
import data from "../../public/data/case.json";
import {
  Stage,
  Clip,
  HeroVideo,
  Icon,
  ProductTable,
  ramp,
  useTime,
  usePop,
  cue,
  C,
  Kicker,
  Burst,
  Pulse,
} from "./Design";
import { Person } from "./StoryArt";
export function Return() {
  const t = useTime(),
    paid = cue("shopper", "buy", 4),
    delivered = cue("shopper", "arrives", 7),
    rec = cue("shopper", "recommendation", 1.9),
    sixteen = cue("shopper", "sixteen", 4.5),
    under = cue("shopper", "under", 11.6),
    pop = usePop(),
    { fps } = useVideoConfig(),
    outro = ramp(t, under - 0.3, under + 0.3),
    sh = data.shopper,
    day = t < delivered ? sh.contactDay : sh.deliveryDay,
    flip = Math.max(pop(1.1, 10) * (t < delivered ? 1 : 0), t >= delivered ? pop(delivered, 10) : 0);
  return (
    <Stage>
      <HeroVideo
        file="film-return"
        zoom={1.14 + 0.06 * ramp(t, 0, 12)}
        x={-200}
        opacity={0.3}
      />
      <Kicker n="05" label="Shopper" left={100} top={120} />
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 175,
          width: 190,
          height: 200,
          borderRadius: 26,
          background: "#fff",
          boxShadow: "0 18px 50px #0a2d4b26",
          overflow: "hidden",
          scale: pop(0.95, 10),
        }}
      >
        <div style={{ height: 52, background: C.blue, color: "#fff", fontSize: 26, fontWeight: 700, letterSpacing: 4, display: "grid", placeItems: "center" }}>
          DAY
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 800,
            letterSpacing: -4,
            textAlign: "center",
            lineHeight: "140px",
            color: C.ink,
            transform: `perspective(400px) rotateX(${(1 - flip) * 90}deg)`,
            transformOrigin: "top center",
          }}
        >
          {day}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 320,
          top: 200,
          fontSize: 58,
          color: C.ink,
          fontWeight: 750,
          letterSpacing: -2,
          lineHeight: 1.1,
          padding: "14px 28px",
          borderRadius: 22,
          background: "#ffffffe6",
          boxShadow: "0 14px 40px #0a2d4b1a",
          scale: pop(1.15, 11),
          transformOrigin: "left center",
        }}
      >
        A quiet shopper
        <br />
        <span style={{ color: C.blue }}>comes back.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 320,
          top: 352,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 24px 12px 16px",
          borderRadius: 40,
          background: "#fff",
          boxShadow: "0 12px 30px #0a2d4b20",
          fontSize: 30,
          fontWeight: 650,
          color: C.ink,
          scale: pop(sixteen - 0.1, 9),
          transformOrigin: "left center",
          opacity: 1 - ramp(t, under - 0.5, under - 0.2),
        }}
      >
        <Icon kind="clock" size={34} color={C.blue} /> {sh.daysSincePurchase} days since last purchase
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: 1 - outro }}>
      <Person
        emotion={-0.15 + 1.15 * ramp(t, paid, paid + 0.7)}
        wave={ramp(t, delivered, delivered + 0.7)}
        thinking={0.25 * (1 - ramp(t, paid, paid + 0.5))}
        gaze={0.6}
        style={{
          left: 360,
          top: 370 - 40 * Math.sin(Math.PI * ramp(t, paid, paid + 0.45)),
          width: 290,
          height: 504,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 700,
          top: 580,
          width: 390,
          height: 0,
          borderTop: "5px dashed #70a8d3",
          opacity: 0.6,
          clipPath: `inset(0 ${(1 - ramp(t, 1.3, 2.2)) * 100}% 0 0)`,
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
          translate: `${(1 - pop(0.9, 13)) * 160 + outro * 700}px ${Math.sin(t * 1.3) * 6}px`,
          rotate: `${(1 - pop(0.9, 13)) * 6}deg`,
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
          <span style={{ display: "inline-block", scale: 0.6 + 0.4 * pop(rec - 0.1, 7), transformOrigin: "left center" }}>● FOR YOU · NEW PICK</span>
        </div>
        <div
          style={{
            position: "absolute",
            left: -65,
            top: 50 + Math.sin(t * 2) * 8,
            scale: 0.73 * (0.6 + 0.4 * pop(1.3, 9)),
          }}
        >
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
          opacity: ramp(t, paid, paid + 0.2),
          translate: `0px ${-35 * ramp(t, paid, paid + 1)}px`,
          scale: pop(paid, 8),
          padding: "10px 24px",
          borderRadius: 40,
          background: "#ffffffee",
          boxShadow: "0 12px 30px #128e7230",
          fontWeight: 700,
        }}
      >
        <Icon kind="check" size={48} />
        $96 purchase
      </div>
      </div>
      <Burst at={paid} x={1445} y={760} spread={330} count={34} />
      <Pulse at={delivered} x={1445} y={760} color="#128e72" size={420} />
      <Sequence from={Math.round((under - 0.2) * fps)} premountFor={fps}>
        <Clip
          file="shopper"
          trim={2}
          box={[1110, 175, 680, 690]}
          crop={[800, 40, 480, 520]}
          label="Market Metro · recorded shopper outcome"
        />
      </Sequence>
      <div style={{ position: "absolute", left: 100, top: 430, display: "grid", gap: 26, opacity: outro }}>
        {[
          { who: "Fixed rules", what: "Request unfilled", icon: "x", color: "#b4532f", bg: "#fff1ea", at: under },
          { who: "Market Metro agent", what: `$${sh.grossCents / 100} paid · delivered day ${sh.deliveryDay}`, icon: "check", color: "#128e72", bg: "#e6f6f0", at: under + 0.5 },
        ].map((row) => (
          <div
            key={row.who}
            style={{
              width: 900,
              display: "flex",
              alignItems: "center",
              gap: 28,
              padding: "28px 34px",
              borderRadius: 28,
              background: row.bg,
              border: `3px solid ${row.color}44`,
              scale: pop(row.at, 11),
              transformOrigin: "left center",
            }}
          >
            <div style={{ width: 86, height: 86, borderRadius: 43, background: row.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon kind={row.icon} size={50} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2, color: row.color }}>{row.who.toUpperCase()}</div>
              <div style={{ fontSize: 48, fontWeight: 750, color: C.ink, marginTop: 4 }}>{row.what}</div>
            </div>
          </div>
        ))}
      </div>
    </Stage>
  );
}
