import { useVideoConfig } from "remotion";
import {
  Stage,
  HeroVideo,
  Icon,
  ProductTable,
  Note,
  ramp,
  useTime,
  C,
} from "./Design";
export function Return() {
  const t = useTime(),
    { durationInFrames, fps } = useVideoConfig(),
    paid = (durationInFrames / fps) * 0.46,
    delivered = 6.2;
  return (
    <Stage label="Day 35 → 36">
      <HeroVideo
        file="film-return"
        zoom={1.14 + 0.1 * ramp(t, 0, 10)}
        x={-200}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(90deg,#071d3e88,transparent 66%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 340,
          fontSize: 130,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: -5,
          color: "#fff",
          textShadow: "0 6px 40px #09284e66",
        }}
      >
        {t < paid ? (
          <>
            A useful
            <br />
            match.
          </>
        ) : t < delivered ? (
          <>
            They
            <br />
            bought.
          </>
        ) : (
          <>
            And it
            <br />
            arrived.
          </>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: 1150,
          top: 150,
          width: 590,
          height: 750,
          background: "#f8fbff",
          border: "10px solid #0d2f55",
          borderRadius: 58,
          overflow: "hidden",
          boxShadow: "0 30px 100px #09284e66",
          rotate: `${2 - 2 * ramp(t, 0, 0.6)}deg`,
          translate: `${(1 - ramp(t, 0, 0.5)) * 100}px 0px`,
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
          <div
            style={{
              height: 76,
              marginTop: 15,
              background: t >= paid ? "#128e72" : C.blue,
              color: "#fff",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              fontSize: 32,
              fontWeight: 600,
            }}
          >
            {t >= paid && (
              <Icon kind={t >= delivered ? "truck" : "check"} size={36} />
            )}{" "}
            {t < paid
              ? "Recommended"
              : t < delivered
                ? "Purchased"
                : "Delivered"}
          </div>
        </div>
      </div>
      <Note dark>
        Illustrated recommendation · saved simulated purchase · fixed left this
        request unfilled
      </Note>
    </Stage>
  );
}
