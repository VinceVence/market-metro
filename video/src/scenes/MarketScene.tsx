import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Merchant} from '../film/Merchant';
import '../video.css';
export const MarketScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Merchant/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/market.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
  {
    "text": "Imagine running a furniture shop with products",
    "startMs": 250,
    "endMs": 2550,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "ready to sell, while a shopper who",
    "startMs": 2600,
    "endMs": 4475,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "could buy from you has gone quiet.",
    "startMs": 4500,
    "endMs": 6750,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
