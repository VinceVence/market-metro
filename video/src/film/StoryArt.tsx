import type { CSSProperties } from "react";
import { useTime, C } from "./Design";

/** Original illustrative characters, with frame-driven expressions and gestures. */
export function Person({
  role = "shopper",
  style = {},
  happy = false,
  emotion,
  thinking = 0,
  wave = 0,
  gaze = 0,
}: {
  role?: "shopper" | "merchant";
  style?: CSSProperties;
  happy?: boolean;
  emotion?: number;
  thinking?: number;
  wave?: number;
  gaze?: number;
}) {
  const t = useTime(),
    merchant = role === "merchant",
    feel = emotion ?? (happy ? 1 : 0.12);
  const worry = Math.max(0, -feel),
    think = Math.min(1, Math.max(0, thinking)),
    greet = Math.min(1, Math.max(0, wave));
  const blink = Math.min(1, Math.abs(((t + 0.35) % 4.1) - 2.5) / 0.075);
  const handX = 151 + (134 - 151) * think + (188 - 151) * greet;
  const handY =
    197 +
    (123 - 197) * think +
    (77 - 197) * greet +
    Math.sin(t * 7) * 7 * greet;
  const elbowX = 180 - 8 * think + 7 * greet,
    elbowY = 207 - 46 * think - 76 * greet;
  return (
    <div style={{ position: "absolute", width: 230, height: 400, ...style }}>
      <svg
        viewBox="0 0 230 400"
        width="100%"
        height="100%"
        aria-label={
          merchant
            ? "Expressive illustrated merchant"
            : "Expressive illustrated shopper"
        }
      >
        <ellipse
          cx="115"
          cy="378"
          rx="75"
          ry="13"
          fill="#0a294b"
          opacity=".1"
        />
        <g transform={`translate(0 ${Math.sin(t * 1.6) * 1.3 - 1.4 * greet})`}>
          <path
            d="M85 245 78 357M142 245l12 112"
            stroke="#243f60"
            strokeWidth="37"
            strokeLinecap="round"
          />
          <path
            d="M77 358H52M155 358h25"
            stroke="#112b49"
            strokeWidth="29"
            strokeLinecap="round"
          />
          <path
            d="M72 138Q114 118 156 138L166 258H61Z"
            fill={merchant ? "#f09b79" : "#169b91"}
          />
          {merchant && (
            <>
              <path
                d="M84 143h60v116H77Zm6-4v-20m46 20v-20"
                fill="#123f67"
                stroke="#123f67"
                strokeWidth="9"
              />
              <rect
                x="93"
                y="192"
                width="44"
                height="31"
                rx="5"
                fill="#ffffff33"
              />
            </>
          )}
          <path
            d={`M72 150Q${45 + 10 * think} ${208 - 18 * think} ${72 + 20 * think} ${244 - 12 * think}`}
            stroke="#d99b76"
            strokeWidth="23"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M155 150Q${elbowX} ${elbowY} ${handX} ${handY}`}
            stroke="#d99b76"
            strokeWidth="23"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx={handX} cy={handY} r="13" fill="#e8ae89" />
          <g
            opacity={1 - Math.max(think, greet)}
            transform={`rotate(-14 ${handX} ${handY})`}
          >
            <rect
              x={handX - 13}
              y={handY - 30}
              width="35"
              height="57"
              rx="7"
              fill="#122f50"
            />
            <rect
              x={handX - 7}
              y={handY - 23}
              width="23"
              height="36"
              rx="3"
              fill="#bfe8ff"
            />
          </g>
          <rect x="98" y="101" width="31" height="37" rx="12" fill="#d99b76" />
          <g transform={`rotate(${-5 * think - 4 * worry + gaze * 2} 114 125)`}>
            <ellipse cx="114" cy="78" rx="49" ry="57" fill="#e8ae89" />
            <path
              d="M65 77Q52 8 113 12q61-3 53 69l-15-39q-26 21-70 11Z"
              fill={merchant ? "#394053" : "#1d304a"}
            />
            <path
              d={`M87 ${63 + 3 * worry}Q97 ${58 - 5 * worry} 106 ${63 - 8 * worry}M122 ${63 - 8 * worry}Q133 ${58 - 5 * worry} 142 ${63 + 3 * worry}`}
              stroke="#4d3b37"
              strokeWidth="3.2"
              fill="none"
              strokeLinecap="round"
            />
            {[97, 132].map((x) => (
              <g key={x}>
                <ellipse
                  cx={x}
                  cy="79"
                  rx="8"
                  ry={Math.max(0.8, 6 * blink)}
                  fill="#fff9ed"
                />
                <ellipse
                  cx={x + gaze * 2.2}
                  cy={79 + think * 1.1}
                  rx="3.8"
                  ry={Math.max(0.6, 4.1 * blink)}
                  fill="#203549"
                />
                <circle
                  cx={x + gaze * 2.2 + 1}
                  cy="77"
                  r="1"
                  fill="#fff"
                  opacity={blink}
                />
              </g>
            ))}
            <path
              d="M114 84v8l4 2"
              stroke="#cc8d70"
              fill="none"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
            <path
              d={`M100 104Q114 ${104 + 14 * feel} 129 104`}
              fill="none"
              stroke="#805345"
              strokeWidth={feel > 0.6 ? 4.6 : 3.7}
              strokeLinecap="round"
            />
            <ellipse
              cx="84"
              cy="96"
              rx="8"
              ry="4"
              fill="#de8c7c"
              opacity={Math.max(0, feel) * 0.4}
            />
            <ellipse
              cx="143"
              cy="96"
              rx="8"
              ry="4"
              fill="#de8c7c"
              opacity={Math.max(0, feel) * 0.4}
            />
          </g>
          <circle cx={handX} cy={handY} r="10" fill="#e8ae89" opacity={think} />
        </g>
      </svg>
    </div>
  );
}

export function Store({ style = {} }: { style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 900 650"
      style={{ position: "absolute", width: 900, height: 650, ...style }}
      aria-label="Illustrated furniture store"
    >
      <ellipse
        cx="445"
        cy="596"
        rx="408"
        ry="32"
        fill="#0a294b"
        opacity=".08"
      />
      <rect x="90" y="160" width="700" height="420" rx="15" fill="#e7edf4" />
      <rect x="115" y="305" width="430" height="243" rx="7" fill="#b7daf0" />
      <rect x="578" y="305" width="176" height="275" rx="7" fill="#40658a" />
      <rect x="595" y="322" width="142" height="209" rx="4" fill="#c9e4f3" />
      <path d="M612 322v209" stroke="#9ec5df" strokeWidth="5" />
      <circle cx="718" cy="456" r="8" fill="#173c64" />
      <path d="m70 280 37-93h666l39 93Z" fill={C.blue} />
      {[0, 2, 4, 6, 8].map((i) => (
        <path
          key={i}
          d={`M${107 + i * 74} 187h74l${i < 5 ? -5 : 5} 93h-77Z`}
          fill="#e8f5ff"
        />
      ))}
      <path d="M70 281h742v26H70Z" fill="#163d68" />
      <rect x="242" y="89" width="390" height="87" rx="12" fill="#123e68" />
      <text
        x="437"
        y="145"
        fill="white"
        textAnchor="middle"
        fontFamily="DM Sans"
        fontWeight="600"
        fontSize="37"
        letterSpacing="4"
      >
        FURNITURE
      </text>
      <path d="M165 418h270v30H165Z" fill="#c4a77a" />
      <path d="M186 449v75m227-75v75" stroke="#6c839b" strokeWidth="14" />
      <rect x="277" y="366" width="102" height="48" rx="8" fill="#f1c376" />
      <rect x="108" y="551" width="664" height="28" fill="#8cabc5" />
      <path
        d="m136 341 112 150m-52-150 112 150"
        stroke="#ffffff66"
        strokeWidth="14"
      />
    </svg>
  );
}
