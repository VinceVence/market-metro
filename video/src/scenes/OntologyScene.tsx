import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Meaning} from '../film/Meaning';
import '../video.css';
export const OntologyScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Meaning/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-neural/ontology.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "An ontology is the shared map underneath.",
    "startMs": 250,
    "endMs": 2978,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "It connects shoppers, products and payments, routes",
    "startMs": 2978,
    "endMs": 5971,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "recommendations and inquiries to the right training",
    "startMs": 5971,
    "endMs": 8965,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "data, and keeps later outcomes out of",
    "startMs": 8965,
    "endMs": 11028,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "model inputs.",
    "startMs": 11028,
    "endMs": 12225,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
