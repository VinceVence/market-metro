import { CanvasImage, Sequence, staticFile, useVideoConfig } from "remotion";
import data from "../../public/data/case.json";
import { Stage, Clip, Icon, ramp, useTime, usePop, cue, usd, C, Kicker, Burst } from "./Design";

export function Payment() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    pop = usePop(),
    r = data.receipt,
    order = cue("paypal", "order", 4.5),
    follow = cue("paypal", "follow", 8.2),
    captures = follow - 0.2,
    gross = cue("paypal", "payment", 7.6),
    fee = cue("paypal", "fee", 8.6),
    proceeds = cue("paypal", "receives", 10),
    each = order - 0.1,
    links = each + 0.5,
    warehouse = each + 1.0,
    counting = cue("paypal", "capture", 6.8) + 0.3;
  // The trail first (order → capture → warehouse → merchant), then the printed receipt.
  const phaseB = ramp(t, each - 0.4, each + 0.1) * (1 - ramp(t, follow - 0.5, follow - 0.1)),
    phaseA = ramp(t, follow - 0.3, follow + 0.2);
  const rows = [
    ["Status", r.status, captures + 0.3, "#22b597"],
    ["Gross", usd(r.gross_cents / 100), gross - 0.3, "#fff"],
    ["PayPal fee", usd(r.fee_cents / 100), fee - 0.3, "#fff"],
    ["Merchant receives", usd(r.net_cents / 100), proceeds - 0.4, C.cyan],
  ] as const;
  const printed = ramp(t, captures, proceeds + 0.3);
  const trail = [
    { icon: "card", name: "PayPal capture", id: r.capture_id, at: each },
    { icon: "tag", name: "PayPal order", id: r.paypal_order_id, at: links },
    { icon: "store", name: "Warehouse order", id: data.shopper.basketId, at: warehouse },
    { icon: "person", name: "Merchant", id: data.shopper.merchant, at: warehouse + 0.8 },
  ];
  return (
    <Stage dark disclosure="PayPal Sandbox · test funds">
      <Kicker n="06" label="Payment" left={115} top={115} dark />
      <div
        style={{
          position: "absolute",
          left: 115,
          top: 160,
          translate: `${(1 - pop(1.0)) * -60}px 0px`,
          opacity: ramp(t, 1.0, 1.25),
          display: "flex",
          alignItems: "center",
          gap: 25,
        }}
      >
        <div style={{ background: "#fff", borderRadius: 24, padding: "15px 23px" }}>
          <CanvasImage src={staticFile("brand/paypal.svg")} premountFor={fps} style={{ width: 64, height: 74 }} />
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3 }}>
          The money leaves a <span style={{ color: C.cyan }}>trail.</span>
        </div>
      </div>

      {/* Phase A — capture and the printed receipt */}
      <div style={{ position: "absolute", inset: 0, opacity: phaseA }}>
        <Burst at={captures + 0.9} x={470} y={560} spread={380} count={30} colors={[C.cyan, "#ffc35c", "#ffffff", C.mint]} />
        <div style={{ position: "absolute", left: 115, top: 400 }}>
          <div
            style={{
              fontSize: 230,
              fontWeight: 750,
              letterSpacing: -12,
              lineHeight: 1,
              scale: 0.9 + 0.1 * pop(captures + 0.9, 8),
              transformOrigin: "left",
              textShadow: `0 0 ${60 * ramp(t, captures + 0.9, captures + 1.1) * (1 - ramp(t, captures + 1.3, captures + 2.5))}px #5fceff`,
            }}
          >
            {usd((r.gross_cents / 100) * ramp(t, captures, captures + 0.9))}
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 44,
              color: C.cyan,
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              padding: "8px 26px 8px 14px",
              borderRadius: 40,
              background: "#5fceff1f",
              border: "2px solid #5fceff55",
              scale: pop(captures + 1, 8),
              transformOrigin: "left",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="2.4" strokeLinecap="round">
              <path d="m4 12 5 5L20 6" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ramp(t, captures + 1.1, captures + 1.5)} />
            </svg>
            Captured in Sandbox
          </div>
        </div>
        <div style={{ position: "absolute", left: 1140, top: 330, width: 620, height: 30, borderRadius: 15, background: "#04111f", boxShadow: "inset 0 4px 10px #000" }} />
        <div style={{ position: "absolute", left: 1170, top: 345, width: 560, height: 560, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: -560 + 560 * printed,
              width: 560,
              height: 560,
              background: "#fff",
              color: C.ink,
              padding: "40px 40px",
              boxSizing: "border-box",
              clipPath:
                "polygon(0 0,100% 0,100% 96%,95% 100%,90% 96%,85% 100%,80% 96%,75% 100%,70% 96%,65% 100%,60% 96%,55% 100%,50% 96%,45% 100%,40% 96%,35% 100%,30% 96%,25% 100%,20% 96%,15% 100%,10% 96%,5% 100%,0 96%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, fontWeight: 700, color: C.muted, letterSpacing: 2 }}>
              <CanvasImage src={staticFile("brand/paypal.svg")} premountFor={fps} style={{ width: 26, height: 30 }} />
              SANDBOX RECEIPT
            </div>
            <div style={{ fontSize: 20, color: C.muted, marginTop: 8, fontFamily: "monospace" }}>Capture {r.capture_id}</div>
            <div style={{ borderTop: "3px dashed #d5dfea", margin: "24px 0 10px" }} />
            {rows.map(([label, value, at, color]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "16px 0",
                  borderBottom: "1px solid #eef2f7",
                  opacity: ramp(t, at, at + 0.25),
                  translate: `${(1 - ramp(t, at, at + 0.35)) * 30}px 0px`,
                }}
              >
                <div style={{ fontSize: 30, color: C.muted }}>{label}</div>
                <div
                  style={{
                    fontSize: label === "Status" ? 26 : 40,
                    fontWeight: 750,
                    color: color === "#fff" ? C.ink : color === C.cyan ? C.blue : "#fff",
                    background: label === "Status" ? "#22b597" : "none",
                    padding: label === "Status" ? "4px 16px" : 0,
                    borderRadius: 14,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Phase B — the trail and the real lineage view */}
      <div style={{ position: "absolute", inset: 0, opacity: phaseB }}>
        <div style={{ position: "absolute", left: 151, top: 360, width: 10, height: 444, borderRadius: 5, background: "#21476f" }} />
        <div
          style={{
            position: "absolute",
            left: 151,
            top: 360,
            width: 10,
            height: 444 * ramp(t, each, warehouse + 0.8),
            borderRadius: 5,
            background: `linear-gradient(180deg, ${C.cyan}, ${C.mint})`,
          }}
        />
        {trail.map((s, i) => {
          const p = pop(s.at - 0.15, 10);
          return (
            <div key={s.name} style={{ position: "absolute", left: 115, top: 320 + i * 148, display: "flex", alignItems: "center", gap: 30, opacity: 0.25 + 0.75 * Math.min(1, p) }}>
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 41,
                  background: "#0a2a4d",
                  border: `6px solid ${C.cyan}`,
                  boxSizing: "border-box",
                  display: "grid",
                  placeItems: "center",
                  scale: 0.7 + 0.3 * p,
                  boxShadow: `0 0 ${30 * p}px #5fceff77`,
                }}
              >
                <Icon kind={s.icon} size={38} color="#fff" />
              </div>
              <div style={{ translate: `${(1 - p) * 40}px 0px` }}>
                <div style={{ fontSize: 38, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 24, color: "#9fc5e9", fontFamily: "monospace", marginTop: 4 }}>{s.id}</div>
              </div>
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 115,
            top: 890,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 24px 10px 14px",
            borderRadius: 30,
            background: "#22b5972a",
            border: "2px solid #22b597",
            color: "#9ff0d6",
            fontSize: 28,
            fontWeight: 700,
            scale: pop(counting - 0.6, 8),
            transformOrigin: "left center",
          }}
        >
          <Icon kind="check" size={30} color="#9ff0d6" /> Traceable · counted once
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: phaseB }}>
      <Sequence from={Math.round((each - 0.3) * fps)} durationInFrames={Math.max(1, Math.round((follow - each + 0.2) * fps))} premountFor={fps}>
        <Clip
          file="paypal-lineage"
          trim={3}
          box={[1000, 300, 800, 640]}
          crop={[817, 143, 410, 430]}
          label="Market Metro · PayPal receipt lineage"
        />
      </Sequence>
      </div>
    </Stage>
  );
}
