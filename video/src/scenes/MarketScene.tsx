import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Merchant} from '../film/Merchant';
import '../video.css';
export const MarketScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Merchant/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-neural/market.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "It was a normal day for Leo.",
    "startMs": 250,
    "endMs": 2015,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "He opened his furniture shop, straightened the",
    "startMs": 2015,
    "endMs": 4537,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "display, and waited.",
    "startMs": 4537,
    "endMs": 6050,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "People hurried past.",
    "startMs": 6050,
    "endMs": 7563,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "One checked their phone.",
    "startMs": 7563,
    "endMs": 9265,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Another glanced at the window and kept",
    "startMs": 9265,
    "endMs": 11282,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "walking.",
    "startMs": 11282,
    "endMs": 12165,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Days went by, but the shop stayed",
    "startMs": 12165,
    "endMs": 13867,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "quiet.",
    "startMs": 13867,
    "endMs": 14623,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Leo had data everywhere, yet he still",
    "startMs": 14623,
    "endMs": 16577,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "couldn't tell who to reach or what",
    "startMs": 16577,
    "endMs": 18342,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "to offer.",
    "startMs": 18342,
    "endMs": 19225,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
