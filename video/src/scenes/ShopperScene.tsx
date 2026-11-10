import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Return} from '../film/Return';
import '../video.css';
export const ShopperScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Return/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/shopper.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "Day thirty five.",
    "startMs": 250,
    "endMs": 1700,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "A recommendation reaches our quiet shopper, sixteen",
    "startMs": 1775,
    "endMs": 4850,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "days after their last purchase.",
    "startMs": 4900,
    "endMs": 7025,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "They buy a ninety six dollar side",
    "startMs": 7100,
    "endMs": 8950,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "table, and it arrives the next day.",
    "startMs": 9000,
    "endMs": 11530,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Under fixed rules, that same request went",
    "startMs": 11580,
    "endMs": 14005,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "unfilled.",
    "startMs": 14080,
    "endMs": 15080,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
