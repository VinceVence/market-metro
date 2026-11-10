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
    "text": "Before a campaign goes out, the verifier",
    "startMs": 250,
    "endMs": 2600,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "checks the candidates against fixed rules.",
    "startMs": 2675,
    "endMs": 5575,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Which one produces better outcomes for merchants",
    "startMs": 5650,
    "endMs": 8275,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "and PayPal?",
    "startMs": 8350,
    "endMs": 9550,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
