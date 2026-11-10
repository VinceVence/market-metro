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
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/ontology.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "It starts by connecting the clues.",
    "startMs": 250,
    "endMs": 2425,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Our ontology connects shoppers, products, contacts and",
    "startMs": 2475,
    "endMs": 5800,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "payments, so each prediction uses the right",
    "startMs": 5850,
    "endMs": 8275,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "examples.",
    "startMs": 8325,
    "endMs": 9575,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Recommendations stay separate from inquiries.",
    "startMs": 9675,
    "endMs": 12325,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "One rule: past signals become inputs; later",
    "startMs": 12425,
    "endMs": 15700,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "outcomes become labels.",
    "startMs": 15750,
    "endMs": 17575,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The model can't peek into the future.",
    "startMs": 17650,
    "endMs": 20000,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
