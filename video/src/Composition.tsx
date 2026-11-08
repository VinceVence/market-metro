import {Composition,Series,useVideoConfig} from "remotion";
import {MarketScene} from "./scenes/MarketScene";
import {DemandScene} from "./scenes/DemandScene";
import {OntologyScene} from "./scenes/OntologyScene";
import {PlannerScene} from "./scenes/PlannerScene";
import {VerifierScene} from "./scenes/VerifierScene";
import {ShopperScene} from "./scenes/ShopperScene";
import {PayPalScene} from "./scenes/PayPalScene";
import {ImpactScene} from "./scenes/ImpactScene";
import {AGGridScene} from "./scenes/AGGridScene";
import {ClosingScene} from "./scenes/ClosingScene";
export const MarketMetroSubmission=()=>{
  const {fps}=useVideoConfig();
  return <Series>
    <Series.Sequence name="Meet Form & Function" durationInFrames={420} premountFor={fps}>
      <MarketScene/>
    </Series.Sequence>
    <Series.Sequence name="A shopper goes quiet" durationInFrames={420} premountFor={fps}>
      <DemandScene/>
    </Series.Sequence>
    <Series.Sequence name="Keep the meaning intact" durationInFrames={420} premountFor={fps}>
      <OntologyScene/>
    </Series.Sequence>
    <Series.Sequence name="Turn activity into a plan" durationInFrames={660} premountFor={fps}>
      <PlannerScene/>
    </Series.Sequence>
    <Series.Sequence name="Test before launch" durationInFrames={540} premountFor={fps}>
      <VerifierScene/>
    </Series.Sequence>
    <Series.Sequence name="The shopper returns" durationInFrames={540} premountFor={fps}>
      <ShopperScene/>
    </Series.Sequence>
    <Series.Sequence name="Payment verified" durationInFrames={600} premountFor={fps}>
      <PayPalScene/>
    </Series.Sequence>
    <Series.Sequence name="A measured result" durationInFrames={562} premountFor={fps}>
      <ImpactScene/>
    </Series.Sequence>
    <Series.Sequence name="Open the evidence" durationInFrames={690} premountFor={fps}>
      <AGGridScene/>
    </Series.Sequence>
    <Series.Sequence name="Market Metro" durationInFrames={150} premountFor={fps}>
      <ClosingScene/>
    </Series.Sequence>
  </Series>;
};
export const MarketMetroComposition=()=><Composition id="MarketMetroSubmission" component={MarketMetroSubmission} durationInFrames={5002} fps={30} width={1920} height={1080}/>;
