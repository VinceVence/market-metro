import { Composition, Folder } from "remotion";
import { MarketMetroComposition } from "./Composition";
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
export const RemotionRoot = () => (
  <>
    <MarketMetroComposition />
    <Folder name="Scenes">
      <Composition
        id="MarketScene"
        component={MarketScene}
        durationInFrames={483}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="DemandScene"
        component={DemandScene}
        durationInFrames={609}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="OntologyScene"
        component={OntologyScene}
        durationInFrames={613}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PlannerScene"
        component={PlannerScene}
        durationInFrames={455}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="VerifierScene"
        component={VerifierScene}
        durationInFrames={480}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ShopperScene"
        component={ShopperScene}
        durationInFrames={411}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PayPalScene"
        component={PayPalScene}
        durationInFrames={527}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ImpactScene"
        component={ImpactScene}
        durationInFrames={623}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="AGGridScene"
        component={AGGridScene}
        durationInFrames={457}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ClosingScene"
        component={ClosingScene}
        durationInFrames={206}
        fps={30}
        width={1920}
        height={1080}
      />
    </Folder>
  </>
);
