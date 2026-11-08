import { CanvasImage, Sequence, staticFile, useVideoConfig } from "remotion";
import data from "../../public/data/case.json";
import { Stage, Clip, Note, ramp, useTime, cue, usd, C } from "./Design";
export function Payment() {
  const t = useTime(),
    { fps } = useVideoConfig(),
    r = data.receipt,
    cut = cue("paypal", "receipt", 8);
  return (
    <Stage dark label="Sandbox · test funds">
      <div
        style={{
          position: "absolute",
          left: 115,
          top: 145,
          display: "flex",
          alignItems: "center",
          gap: 25,
        }}
      >
        <div
          style={{ background: "#fff", borderRadius: 24, padding: "15px 23px" }}
        >
          <CanvasImage
            src={staticFile("brand/paypal.svg")}
            premountFor={fps}
            style={{ width: 64, height: 74 }}
          />
        </div>
        <div style={{ fontSize: 84, fontWeight: 650, letterSpacing: -3 }}>
          PayPal
        </div>
      </div>
      <div style={{ position: "absolute", left: 115, top: 340 }}>
        <div
          style={{
            fontSize: 240,
            fontWeight: 700,
            letterSpacing: -14,
            scale: 0.96 + 0.04 * ramp(t, 0, 0.5),
            transformOrigin: "left",
          }}
        >
          {usd(r.gross_cents / 100)}
        </div>
        <div style={{ fontSize: 48, color: C.cyan }}>Captured.</div>
      </div>
      {t < cut && (
        <div
          style={{
            position: "absolute",
            left: 1160,
            top: 430,
            opacity: ramp(t, 1.5, 1.8),
          }}
        >
          <div style={{ fontSize: 90, fontWeight: 600 }}>
            {usd(r.fee_cents / 100)}
          </div>
          <div style={{ fontSize: 32, color: "#9fc5e9" }}>PayPal fee</div>
          <div style={{ fontSize: 65, marginTop: 40 }}>
            {usd(r.net_cents / 100)}
          </div>
          <div style={{ fontSize: 32, color: "#9fc5e9" }}>
            Merchant receives
          </div>
        </div>
      )}
      <Sequence from={Math.round(cut * fps)} premountFor={fps}>
        <Clip
          file="paypal-lineage"
          trim={3}
          box={[1050, 285, 700, 620]}
          crop={[817, 143, 410, 430]}
        />
      </Sequence>
      <Note dark>
        Archived native Sandbox receipt · existing order · no real money
      </Note>
    </Stage>
  );
}
