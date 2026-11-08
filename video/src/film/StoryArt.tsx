import type { CSSProperties } from "react";
import { useTime, C } from "./Design";

/** Original illustrative characters; never presented as additional app footage. */
export function Person({
  role = "shopper",
  style = {},
  happy = false,
}: {
  role?: "shopper" | "merchant";
  style?: CSSProperties;
  happy?: boolean;
}) {
  const t = useTime(),
    merchant = role === "merchant";
  return (
    <div style={{ position: "absolute", width: 230, height: 400, ...style }}>
      <svg
        viewBox="0 0 230 400"
        width="100%"
        height="100%"
        aria-label={merchant ? "Illustrated merchant" : "Illustrated shopper"}
      >
        <ellipse
          cx="115"
          cy="378"
          rx="75"
          ry="13"
          fill="#0a294b"
          opacity=".1"
        />
        <g transform={`translate(0 ${Math.sin(t * 1.6) * 2})`}>
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
            <path
              d="M84 143h60v116H77Zm6-4v-20m46 20v-20"
              fill="#123f67"
              stroke="#123f67"
              strokeWidth="9"
            />
          )}
          <path
            d={merchant ? "M71 149 45 209 72 233" : "M72 150 48 210 72 250"}
            stroke="#d99b76"
            strokeWidth="23"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M155 150 180 207 151 197"
            stroke="#d99b76"
            strokeWidth="23"
            fill="none"
            strokeLinecap="round"
          />
          <rect
            x="139"
            y="168"
            width="35"
            height="57"
            rx="7"
            fill="#122f50"
            transform="rotate(-14 155 194)"
          />
          <rect
            x="145"
            y="175"
            width="23"
            height="36"
            rx="3"
            fill="#bfe8ff"
            transform="rotate(-14 155 194)"
          />
          <rect x="98" y="101" width="31" height="37" rx="12" fill="#d99b76" />
          <ellipse cx="114" cy="78" rx="49" ry="57" fill="#e8ae89" />
          <path
            d="M65 77Q52 8 113 12q61-3 53 69l-15-39q-26 21-70 11Z"
            fill={merchant ? "#394053" : "#1d304a"}
          />
          <circle cx="97" cy="79" r="4" fill="#263545" />
          <circle cx="132" cy="79" r="4" fill="#263545" />
          <path
            d={happy ? "M100 101q14 15 29-1" : "M105 106h18"}
            fill="none"
            stroke="#7a4c40"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {merchant && (
            <rect
              x="93"
              y="192"
              width="44"
              height="31"
              rx="5"
              fill="#ffffff33"
            />
          )}
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
