import { AbsoluteFill, Composition, Series, useVideoConfig } from "remotion";
import { Soundtrack } from "./Soundtrack";
import { MarketScene } from "./scenes/MarketScene";
import { DemandScene } from "./scenes/DemandScene";
import { OntologyScene } from "./scenes/OntologyScene";
import { PlannerScene } from "./scenes/PlannerScene";
import { VerifierScene } from "./scenes/VerifierScene";
import { ShopperScene } from "./scenes/ShopperScene";
import { PayPalScene } from "./scenes/PayPalScene";
import { ImpactScene } from "./scenes/ImpactScene";
import { AGGridScene } from "./scenes/AGGridScene";
import { ClosingScene } from "./scenes/ClosingScene";
export const MarketMetroSubmission = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Soundtrack />
      <Series>
        <Series.Sequence
          name="A shop and a quiet shopper"
          durationInFrames={209}
          offset={0}
          premountFor={fps}
        >
          <MarketScene />
        </Series.Sequence>
        <Series.Sequence
          name="A reason to reach out"
          durationInFrames={328}
          offset={-10}
          premountFor={fps}
        >
          <DemandScene />
        </Series.Sequence>
        <Series.Sequence
          name="Connect the evidence"
          durationInFrames={334}
          offset={-10}
          premountFor={fps}
        >
          <OntologyScene />
        </Series.Sequence>
        <Series.Sequence
          name="Build the campaign"
          durationInFrames={335}
          offset={-10}
          premountFor={fps}
        >
          <PlannerScene />
        </Series.Sequence>
        <Series.Sequence
          name="Test before sending"
          durationInFrames={316}
          offset={-10}
          premountFor={fps}
        >
          <VerifierScene />
        </Series.Sequence>
        <Series.Sequence
          name="The recommendation becomes a purchase"
          durationInFrames={369}
          offset={-10}
          premountFor={fps}
        >
          <ShopperScene />
        </Series.Sequence>
        <Series.Sequence
          name="A payment you can trace"
          durationInFrames={345}
          offset={-10}
          premountFor={fps}
        >
          <PayPalScene />
        </Series.Sequence>
        <Series.Sequence
          name="What changed"
          durationInFrames={404}
          offset={-10}
          premountFor={fps}
        >
          <ImpactScene />
        </Series.Sequence>
        <Series.Sequence
          name="Follow the full trail"
          durationInFrames={303}
          offset={-10}
          premountFor={fps}
        >
          <AGGridScene />
        </Series.Sequence>
        <Series.Sequence
          name="Agentic commerce that learns"
          durationInFrames={240}
          offset={-10}
          premountFor={fps}
        >
          <ClosingScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
export const MarketMetroComposition = () => (
  <Composition
    id="MarketMetroSubmission"
    component={MarketMetroSubmission}
    durationInFrames={3093}
    fps={30}
    width={1920}
    height={1080}
  />
);
