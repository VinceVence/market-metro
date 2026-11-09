import role from "../../public/data/ontology-role.json";
import { Stage, Icon, ramp, useTime, cue, C } from "./Design";
export function Meaning() {
  const t = useTime(),
    split = cue("ontology", "connects", 2),
    future = cue("ontology", "signals", 6);
  return (
    <Stage disclosure="Historical training example">
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 150,
          fontSize: 78,
          fontWeight: 650,
          letterSpacing: -3,
        }}
      >
        Data. With meaning.
      </div>
      <svg
        width="1920"
        height="1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <path
          d="M480 560H565V405H650M565 560v175h85M1100 405h100v155h90"
          stroke="#9dbedc"
          strokeWidth="6"
          fill="none"
        />
        <path d="M1100 735h100" stroke="#a7cec7" strokeWidth="6" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 405,
          width: 370,
          height: 305,
          borderRadius: 30,
          background: "#e4f1ff",
          display: "grid",
          alignContent: "center",
          justifyItems: "center",
          gap: 25,
          color: C.ink,
        }}
      >
        <Icon kind="person" size={82} color={C.blue} />
        <div style={{ fontSize: 37, fontWeight: 600 }}>Who to contact?</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 650,
          top: 310,
          width: 450,
          height: 210,
          borderRadius: 26,
          background: C.blue,
          color: "#fff",
          padding: 30,
          boxSizing: "border-box",
          opacity: 0.3 + 0.7 * ramp(t, split - 0.4, split + 0.3),
        }}
      >
        <div style={{ fontSize: 67, fontWeight: 650 }}>
          {role.productContacts.toLocaleString("en-US")}
        </div>
        <div style={{ fontSize: 31 }}>product recommendations</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 650,
          top: 625,
          width: 450,
          height: 210,
          borderRadius: 26,
          background: "#e1f2ed",
          padding: 30,
          boxSizing: "border-box",
          opacity: 0.3 + 0.7 * ramp(t, split, split + 0.5),
        }}
      >
        <div style={{ fontSize: 67, fontWeight: 650, color: "#168b75" }}>
          {role.inquiryContacts.toLocaleString("en-US")}
        </div>
        <div style={{ fontSize: 31 }}>general inquiries</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1290,
          top: 330,
          width: 500,
          height: 295,
          borderRadius: 26,
          background: "#fff",
          border: "2px solid #b9dccc",
          padding: 30,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontSize: 29,
            fontWeight: 600,
            color: "#168b75",
            marginBottom: 25,
          }}
        >
          Known before contact
        </div>
        {["Product interest", "Purchase history"].map((x) => (
          <div
            key={x}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontSize: 33,
              marginTop: 20,
            }}
          >
            <Icon kind="check" size={32} color="#168b75" />
            {x}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 1290,
          top: 690,
          width: 500,
          padding: 28,
          borderRadius: 22,
          background: "#fff0e6",
          boxSizing: "border-box",
          opacity: ramp(t, future - 0.2, future + 0.35),
        }}
      >
        <div style={{ fontSize: 31, fontWeight: 600, color: "#a46826" }}>
          Later payment outcomes
        </div>
        <div style={{ fontSize: 28, color: "#805d3d", marginTop: 12 }}>
          Labels, not model inputs
        </div>
      </div>
    </Stage>
  );
}
