import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Testing} from '../film/Testing';
import '../video.css';
export const VerifierScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Testing/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/verifier.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "A prediction isn't enough.",
    "startMs": 250,
    "endMs": 2231,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The verifier tests both candidates, checking PayPal",
    "startMs": 2231,
    "endMs": 5306,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "and merchant outcomes under matching conditions.",
    "startMs": 5306,
    "endMs": 8654,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The winner earns its place through measured",
    "startMs": 8654,
    "endMs": 11182,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "results; otherwise, the current policy stays.",
    "startMs": 11182,
    "endMs": 14325,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
