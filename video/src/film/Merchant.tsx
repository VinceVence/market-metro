import { Easing, interpolate } from "remotion";
import { Stage, Icon, ramp, useTime, usePop, cue, C, Brand, clamp } from "./Design";
import { Person } from "./StoryArt";
import { CityStreet, DOORS, GROUND } from "./City";

/** Right-hand story panel shared by every beat, so the frame never feels scattered. */
const PANEL = { left: 1130, width: 680 };

const WHO = ["Everyone", "Past buyers", "New visitors", "Nearby", "Weekend crowd"];
const WHAT = ["10% off", "Free delivery", "New arrivals", "Bundle deal", "Clearance"];

export function Merchant() {
  const t = useTime(),
    pop = usePop(),
    meet = cue("market", "owner", 3.6),
    every = cue("market", "every", 4.6),
    leave = cue("market", "away", 7.4),
    clues = cue("market", "clues", 9),
    looked = cue("market", "looked", 10),
    almost = cue("market", "almost", 11.3),
    paid = cue("market", "paid", 12.8),
    places = cue("market", "different", 14.2),
    guess = cue("market", "guess", 16.6),
    who = cue("market", "who", 17.6),
    what = cue("market", "with", 19.8);
  // Night hook → camera push into Leo's store as day breaks.
  const look = cue("market", "look", 0.9),
    gone = cue("market", "leave", 2.6),
    most = cue("market", "leo", 3.5),
    why = cue("market", "why", 4.9),
    hello = cue("market", "meet", 5.2);
  const push =
      0.22 + 0.1 * interpolate(t, [0, why + 0.4], [0, 1], clamp) +
      0.68 * interpolate(t, [why + 0.4, hello + 1.3], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }),
    night = 1 - interpolate(t, [why + 0.5, hello + 1.1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) }),
    hook = 1 - ramp(t, why + 0.45, why + 1.0),
    story = ramp(t, hello + 0.6, hello + 1.0),
    leoIn = pop(hello + 0.65, 12);
  const sad = ramp(t, leave - 0.4, leave + 0.6),
    thinking = ramp(t, clues - 0.3, clues + 0.5) * (1 - ramp(t, guess - 0.3, guess + 0.2)),
    worried = ramp(t, guess - 0.3, guess + 0.3);
  const cluesOn = ramp(t, clues - 0.4, clues) * (1 - ramp(t, guess - 0.6, guess - 0.2)),
    apart = ramp(t, places - 0.2, places + 0.7),
    slot = ramp(t, guess - 0.4, guess);
  const walkers = [
    { at: every - 0.2, y: 545, flip: false, gaze: 0.8 },
    { at: every + 1.0, y: 560, flip: true, gaze: -0.8 },
    { at: every + 2.1, y: 540, flip: false, gaze: 0.6 },
  ];
  const clueCards = [
    { icon: "eye", title: "What they looked at", sub: "Browsing", at: looked, x: 0, y: 0, r: -4 },
    { icon: "bag", title: "What they almost bought", sub: "Product interest", at: almost, x: 150, y: 20, r: 3 },
    { icon: "card", title: "How they paid", sub: "Payments", at: paid, x: 40, y: 40, r: -2 },
  ];
  const shuffle = (list: string[], stopAt: number, speed: number) =>
    t >= stopAt ? null : list[Math.floor(t * speed) % list.length];
  return (
    <Stage brand={false} enter={false}>
      <CityStreet night={night} push={push}>
        {/* Clues float up from every visit — and dissolve */}
        {Array.from({ length: 10 }, (_, k) => {
          const at = 0.5 + k * 0.48,
            d = (t - at) / 1.7;
          if (d < 0 || d > 1) return null;
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: DOORS[(k * 3) % DOORS.length] - 30,
                top: GROUND - 90 - d * 170,
                width: 60,
                height: 60,
                borderRadius: 30,
                background: "#5fceff22",
                border: "2px solid #5fceff88",
                display: "grid",
                placeItems: "center",
                opacity: Math.sin(d * Math.PI) * night,
                filter: `blur(${Math.max(0, d - 0.6) * 10}px)`,
                scale: 0.8 + 0.4 * d,
              }}
            >
              <Icon kind={["eye", "bag", "card", "heart"][k % 4]} size={32} color="#bdefff" />
            </div>
          );
        })}
      </CityStreet>
      {/* Vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 55%, #0000 45%, #020a16cc 100%)", opacity: night }} />
      {/* Kinetic hook */}
      <div style={{ position: "absolute", left: 110, top: 120, opacity: hook, scale: 1 + 0.15 * (1 - hook), transformOrigin: "left top" }}>
        {[
          { words: ["They", "look."], at: look - 0.15 },
          { words: ["They", "leave."], at: gone - 0.35 },
          { words: ["Leo", "wonders", "why."], at: most - 0.1 },
        ].map((line, li) => (
          <div key={li} style={{ display: "flex", gap: 26, fontSize: 112, fontWeight: 750, letterSpacing: -4, lineHeight: 1.08, color: "#fff" }}>
            {line.words.map((w, wi) => {
              const p = pop(line.at + wi * 0.12, 11);
              const accent = w === "why.";
              return (
                <span
                  key={wi}
                  style={{
                    display: "inline-block",
                    opacity: Math.min(1, p * 1.4),
                    translate: `0px ${(1 - p) * 70}px`,
                    textShadow: accent ? "none" : "0 6px 40px #000a",
                    ...(accent
                      ? { background: "linear-gradient(90deg,#ffb84a,#ff7a59)", WebkitBackgroundClip: "text", color: "transparent" }
                      : li === 1
                        ? { color: "#9fb8d4" }
                        : {}),
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", inset: 0, opacity: story }}>
        {walkers.map((w, i) => {
          const k = (t - w.at) / 3.6;
          if (k < 0 || k > 1) return null;
          const x = w.flip ? 2050 - k * 2400 : -260 + k * 2400;
          return (
            <Person
              key={i}
              emotion={0}
              gaze={w.gaze}
              style={{
                left: x,
                top: w.y + 40 - Math.abs(Math.sin(t * 7 + i)) * 9,
                width: 175,
                height: 304,
                opacity: 0.92,
                scale: w.flip ? "-1 1" : "1 1",
              }}
            />
          );
        })}
        <Person
          role="merchant"
          emotion={0.7 - 1.2 * sad - 0.3 * worried + 0.2 * thinking}
          wave={(1 - sad) * ramp(t, hello + 0.95, hello + 1.45)}
          thinking={thinking}
          gaze={0.4 + thinking * 0.4 - 0.9 * sad * (1 - thinking)}
          style={{ left: 680, top: 355 + (1 - leoIn) * 60, width: 330, height: 574, scale: 0.85 + 0.15 * leoIn, transformOrigin: "bottom center" }}
        />
        {/* Name card */}
        <div
          style={{
            position: "absolute",
            left: 650,
            top: 255,
            padding: "12px 28px",
            borderRadius: 40,
            background: "#ffffffee",
            boxShadow: "0 12px 30px #0a2d4b22",
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            scale: pop(Math.max(meet - 0.3, hello + 1.2), 10),
            opacity: 1 - ramp(t, clues - 0.6, clues - 0.2),
          }}
        >
          <span style={{ fontSize: 44, fontWeight: 750, color: C.ink }}>Leo</span>
          <span style={{ fontSize: 26, color: C.muted }}>Owner · furniture shop</span>
        </div>
        {/* Beat: shoppers leave */}
        <div
          style={{
            position: "absolute",
            left: PANEL.left,
            top: 340,
            width: PANEL.width,
            opacity: ramp(t, leave - 0.3, leave + 0.1) * (1 - ramp(t, clues - 0.6, clues - 0.3)),
          }}
        >
          <div
            style={{
              padding: "34px 40px",
              borderRadius: 30,
              background: "#fff",
              boxShadow: "0 20px 55px #0a2d4b1c",
              scale: pop(leave - 0.3, 11),
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3, color: C.muted }}>TODAY AT LEO&apos;S</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              {[
                ["eye", "Walked by", C.blue],
                ["store", "Browsed", C.blue],
                ["x", "Came back", "#d1603d"],
              ].map(([icon, label, color], i) => (
                <div key={label} style={{ display: "grid", justifyItems: "center", gap: 10, opacity: ramp(t, leave - 0.2 + i * 0.25, leave + i * 0.25) }}>
                  <div style={{ width: 130, height: 130, borderRadius: 65, background: i === 2 ? "#fff1ea" : "#e8f3ff", display: "grid", placeItems: "center" }}>
                    <Icon kind={icon} size={64} color={color} />
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 650, color: C.ink }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Beat: the clues — then they turn out to live apart */}
      <div style={{ position: "absolute", inset: 0, opacity: cluesOn }}>
        <div
          style={{
            position: "absolute",
            left: PANEL.left,
            top: 205,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
            color: apart > 0.5 ? "#c05a35" : C.blue,
          }}
        >
          {apart > 0.5 ? "IN THREE DIFFERENT PLACES" : "LEO HAS CLUES"}
        </div>
        <svg width="1920" height="1080" style={{ position: "absolute", inset: 0, opacity: apart }}>
          {[0, 1].map((i) => (
            <path
              key={i}
              d={`M${PANEL.left + 300 + clueCards[i].x} ${380 + i * 200 + clueCards[i].y} L${PANEL.left + 300 + clueCards[i + 1].x} ${380 + (i + 1) * 200 + clueCards[i + 1].y - 90}`}
              stroke="#f0a07f"
              strokeWidth="5"
              strokeDasharray="10 12"
              fill="none"
            />
          ))}
        </svg>
        {clueCards.map((c, i) => {
          const p = pop(c.at - 0.25, 10);
          return (
            <div
              key={c.title}
              style={{
                position: "absolute",
                left: PANEL.left + c.x * apart,
                top: 260 + i * 200 + c.y * apart,
                width: PANEL.width - 150 * apart,
                display: "flex",
                alignItems: "center",
                gap: 24,
                padding: "26px 30px",
                borderRadius: 26,
                background: "#fff",
                border: `3px ${apart > 0.5 ? "dashed #f0a07f" : "solid #e1ebf4"}`,
                boxShadow: "0 18px 45px #0a2d4b18",
                boxSizing: "border-box",
                scale: p,
                rotate: `${c.r * apart + (1 - p) * 10}deg`,
                transformOrigin: "left center",
              }}
            >
              <div style={{ width: 84, height: 84, borderRadius: 42, background: "#e8f3ff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon kind={c.icon} size={44} color={C.blue} />
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: C.ink, whiteSpace: "nowrap" }}>{c.title}</div>
                <div style={{ fontSize: 26, color: C.muted, marginTop: 4 }}>{c.sub}</div>
              </div>
            </div>
          );
        })}
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: PANEL.left + 274 + (clueCards[i].x + clueCards[i + 1].x) / 2,
              top: 409 + i * 200 + (clueCards[i].y + clueCards[i + 1].y) / 2,
              width: 52,
              height: 52,
              borderRadius: 26,
              background: "#fff1ea",
              border: "3px solid #f0a07f",
              display: "grid",
              placeItems: "center",
              scale: pop(places + 0.3 + i * 0.2, 8),
            }}
          >
            <Icon kind="x" size={28} color="#c05a35" />
          </div>
        ))}
      </div>

      {/* Beat: every campaign is a guess → WHO? WHAT? */}
      <div
        style={{
          position: "absolute",
          left: PANEL.left,
          top: 250,
          width: PANEL.width,
          opacity: slot,
          scale: pop(guess - 0.4, 11),
          rotate: `${Math.sin(t * 1.3) * 0.8}deg`,
        }}
      >
        <div style={{ borderRadius: 34, background: "#fff", boxShadow: "0 24px 65px #0a2d4b24", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "22px 34px", background: C.ink, color: "#fff", fontSize: 30, fontWeight: 700 }}>
            <Icon kind="chat" size={34} color={C.cyan} /> Next campaign
            <span style={{ marginLeft: "auto", fontSize: 24, color: "#ffb84a", letterSpacing: 2 }}>
              {t < who ? "GUESSING…" : "UNKNOWN"}
            </span>
          </div>
          {[
            { label: "SEND TO", list: WHO, stop: who, q: "WHO?", speed: 9 },
            { label: "OFFER", list: WHAT, stop: what, q: "WHAT?", speed: 7 },
          ].map((row) => {
            const word = shuffle(row.list, row.stop, row.speed),
              hit = pop(row.stop, 7);
            return (
              <div key={row.label} style={{ padding: "26px 34px", borderTop: "1px solid #e8eef5" }}>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: C.muted }}>{row.label}</div>
                <div style={{ height: 110, display: "flex", alignItems: "center", overflow: "hidden" }}>
                  {word ? (
                    <div style={{ fontSize: 56, fontWeight: 700, color: "#9fb2c6", filter: "blur(1.5px)", translate: `0px ${((t * row.speed) % 1) * -30}px` }}>
                      {word}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 96,
                        fontWeight: 800,
                        letterSpacing: -4,
                        background: `linear-gradient(90deg, ${C.blue}, ${C.mint})`,
                        WebkitBackgroundClip: "text",
                        color: "transparent",
                        scale: 0.6 + 0.4 * hit,
                        transformOrigin: "left center",
                      }}
                    >
                      {row.q}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Brand opacity={ramp(t, hello + 1.3, hello + 1.9)} />
    </Stage>
  );
}
