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
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/market.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "They look.",
    "startMs": 250,
    "endMs": 700,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "They leave.",
    "startMs": 890,
    "endMs": 1740,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Leo wonders why.",
    "startMs": 1840,
    "endMs": 3215,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Meet Leo, a furniture shop owner.",
    "startMs": 3665,
    "endMs": 6090,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Every day, people browse and walk away.",
    "startMs": 6165,
    "endMs": 8660,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "He has clues: what they looked at,",
    "startMs": 8710,
    "endMs": 10535,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "almost bought, and paid for.",
    "startMs": 10585,
    "endMs": 12535,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "But those clues sit in different places.",
    "startMs": 12610,
    "endMs": 15085,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "His next offer is still a guess.",
    "startMs": 15160,
    "endMs": 17360,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Who should he reach, and with what?",
    "startMs": 17435,
    "endMs": 19510,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
