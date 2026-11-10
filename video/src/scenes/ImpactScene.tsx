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
    "text": "Across the same market: sixteen more purchases",
    "startMs": 250,
    "endMs": 2953,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "kept.",
    "startMs": 2953,
    "endMs": 3696,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Two thousand three hundred forty five dollars",
    "startMs": 3696,
    "endMs": 6332,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "more payment volume.",
    "startMs": 6332,
    "endMs": 7954,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Over a thousand dollars more merchant contribution.",
    "startMs": 7954,
    "endMs": 11400,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "And about a hundred fifteen dollars more",
    "startMs": 11400,
    "endMs": 13697,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "modeled PayPal net, after AI cost.",
    "startMs": 13697,
    "endMs": 16063,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "All compared with fixed rules.",
    "startMs": 16063,
    "endMs": 18225,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
