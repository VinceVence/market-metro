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
    "text": "Can AI work out which customers to",
    "startMs": 250,
    "endMs": 2375,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "reach, what to recommend, and build the",
    "startMs": 2425,
    "endMs": 4750,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "campaign automatically?",
    "startMs": 4800,
    "endMs": 6550,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
