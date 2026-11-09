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
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-neural/verifier.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "Before a campaign launches, the verifier tests",
    "startMs": 250,
    "endMs": 3079,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "the candidate models in matching development markets.",
    "startMs": 3079,
    "endMs": 6828,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "It checks PayPal and merchant outcomes, then",
    "startMs": 6828,
    "endMs": 9515,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "publishes an eligible tested configuration or keeps",
    "startMs": 9515,
    "endMs": 12698,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "the current policy.",
    "startMs": 12698,
    "endMs": 14325,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
