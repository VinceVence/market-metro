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
import { MetroOverlay } from "./film/Metro";
export const MarketMetroSubmission = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Soundtrack />
      <Series>
        <Series.Sequence
          name="A normal day for Leo"
          durationInFrames={835} offset={0}
          premountFor={fps}
        >
          <MarketScene />
        </Series.Sequence>
        <Series.Sequence
          name="What Market Metro is"
          durationInFrames={560} offset={-18}
          premountFor={fps}
        >
          <DemandScene />
        </Series.Sequence>
        <Series.Sequence
          name="The right data for the question"
          durationInFrames={621} offset={-18}
          premountFor={fps}
        >
          <OntologyScene />
        </Series.Sequence>
        <Series.Sequence
          name="From understanding to action"
          durationInFrames={497} offset={-18}
          premountFor={fps}
        >
          <PlannerScene />
        </Series.Sequence>
        <Series.Sequence
          name="Test before sending"
          durationInFrames={468} offset={-18}
          premountFor={fps}
        >
          <VerifierScene />
        </Series.Sequence>
        <Series.Sequence
          name="The recommendation becomes a purchase"
          durationInFrames={470} offset={-18}
          premountFor={fps}
        >
          <ShopperScene />
        </Series.Sequence>
        <Series.Sequence
          name="A payment you can trace"
          durationInFrames={481} offset={-18}
          premountFor={fps}
        >
          <PayPalScene />
        </Series.Sequence>
        <Series.Sequence
          name="What changed"
          durationInFrames={622} offset={-18}
          premountFor={fps}
        >
          <ImpactScene />
        </Series.Sequence>
        <Series.Sequence
          name="Follow the full trail"
          durationInFrames={448} offset={-18}
          premountFor={fps}
        >
          <AGGridScene />
        </Series.Sequence>
        <Series.Sequence
          name="Agentic commerce that learns"
          durationInFrames={348} offset={-18}
          premountFor={fps}
        >
          <ClosingScene />
        </Series.Sequence>
      </Series>
      <MetroOverlay />
    </AbsoluteFill>
  );
};
export const MarketMetroComposition = () => (
  <Composition
    id="MarketMetroSubmission"
    component={MarketMetroSubmission}
    durationInFrames={5188}
    fps={30}
    width={1920}
    height={1080}
  />
);
