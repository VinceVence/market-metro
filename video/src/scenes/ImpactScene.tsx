import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Results} from '../film/Results';
import '../video.css';
export const ImpactScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Results/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/impact.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "And across this market, the difference adds",
    "startMs": 250,
    "endMs": 2825,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "up.",
    "startMs": 2825,
    "endMs": 3451,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Sixteen more retained purchases.",
    "startMs": 3451,
    "endMs": 5887,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Over twenty three hundred dollars in additional",
    "startMs": 5887,
    "endMs": 8741,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "payment volume.",
    "startMs": 8741,
    "endMs": 10133,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "More than a thousand dollars in extra",
    "startMs": 10133,
    "endMs": 12290,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "merchant contribution.",
    "startMs": 12290,
    "endMs": 14169,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "And roughly a hundred fifteen dollars more",
    "startMs": 14169,
    "endMs": 16675,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "in modeled PayPal net, after AI cost.",
    "startMs": 16675,
    "endMs": 19250,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
