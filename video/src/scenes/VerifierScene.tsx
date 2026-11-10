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
    "text": "But nothing ships on a hunch.",
    "startMs": 250,
    "endMs": 2426,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The verifier tests both models in matching",
    "startMs": 2426,
    "endMs": 5037,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "development markets, checking PayPal and merchant outcomes",
    "startMs": 5037,
    "endMs": 8808,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "side by side.",
    "startMs": 8808,
    "endMs": 10041,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Only a tested winner is published; otherwise,",
    "startMs": 10041,
    "endMs": 12869,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "the current policy stays.",
    "startMs": 12869,
    "endMs": 14900,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
