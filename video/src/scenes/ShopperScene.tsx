import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Return} from '../film/Return';
import '../video.css';
export const ShopperScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Return/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/shopper.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
  {
    "text": "On day thirty five, the selected recommendation",
    "startMs": 250,
    "endMs": 2975,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "reaches our shopper.",
    "startMs": 3050,
    "endMs": 4550,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "They buy a ninety six dollar side",
    "startMs": 4625,
    "endMs": 6450,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "table, and it arrives the next day;",
    "startMs": 6500,
    "endMs": 8890,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "fixed rules left that same request unfilled.",
    "startMs": 8965,
    "endMs": 12090,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
