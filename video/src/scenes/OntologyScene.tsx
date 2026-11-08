import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Meaning} from '../film/Meaning';
import '../video.css';
export const OntologyScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Meaning/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/ontology.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
  {
    "text": "So Market Metro first connects the shopper,",
    "startMs": 250,
    "endMs": 2900,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "product and payment records.",
    "startMs": 2975,
    "endMs": 4925,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Its ontology keeps split merchant orders tied",
    "startMs": 5000,
    "endMs": 7550,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "to one checkout, and holds any links",
    "startMs": 7600,
    "endMs": 9700,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "it can't trust.",
    "startMs": 9750,
    "endMs": 10925,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
