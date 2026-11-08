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
    "text": "The ontology maps each business question to",
    "startMs": 250,
    "endMs": 2875,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "the right training examples.",
    "startMs": 2900,
    "endMs": 4800,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Product recommendations and general inquiries follow separate",
    "startMs": 4875,
    "endMs": 8200,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "paths, while later payment outcomes supply labels,",
    "startMs": 8250,
    "endMs": 11625,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "not predictors.",
    "startMs": 11700,
    "endMs": 12975,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
