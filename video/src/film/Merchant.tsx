import { Stage, HeroVideo, Note, ramp, useTime } from "./Design";
export function Merchant() {
  const t = useTime();
  return (
    <Stage label="Simulated market">
      <HeroVideo
        file="film-world"
        zoom={1 + 0.18 * ramp(t, 0, 2)}
        opacity={1 - ramp(t, 1.5, 2)}
      />
      <HeroVideo
        file="film-shop"
        zoom={1.07 + 0.16 * ramp(t, 1.5, 7)}
        x={-45}
        opacity={ramp(t, 1.5, 2)}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg,#062b52dd,transparent 78%)",
          opacity: ramp(t, 2, 2.4),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 380,
          color: "#fff",
          textShadow: "0 6px 30px #09284e44",
          fontSize: 144,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: -7,
          opacity: ramp(t, 2.2, 2.5),
          translate: `${(1 - ramp(t, 2.2, 2.5)) * -45}px 0px`,
        }}
      >
        {t < 4.1 ? (
          <>
            Gone
            <br />
            quiet?
          </>
        ) : (
          <>
            Bring
            <br />
            them back.
          </>
        )}
      </div>
      <Note dark>12 shops · 600 simulated shoppers</Note>
    </Stage>
  );
}
