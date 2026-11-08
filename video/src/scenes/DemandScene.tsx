import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Quiet} from '../film/Quiet';
import '../video.css';
export const DemandScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Quiet/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/problem.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
  {
    "text": "The answer starts with your data.",
    "startMs": 250,
    "endMs": 2375,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Market Metro uses an ontology, a shared",
    "startMs": 2475,
    "endMs": 5350,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "map of shoppers, products and payments, to",
    "startMs": 5400,
    "endMs": 7995,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "turn scattered records into connected evidence.",
    "startMs": 8045,
    "endMs": 10870,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
