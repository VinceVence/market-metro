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
    "text": "Shoppers look around, pick things up, and",
    "startMs": 250,
    "endMs": 2385,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "then they're gone.",
    "startMs": 2410,
    "endMs": 3560,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Most shops never find out why.",
    "startMs": 3635,
    "endMs": 5585,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Meet Leo.",
    "startMs": 6585,
    "endMs": 7710,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "He runs a small furniture shop in",
    "startMs": 7760,
    "endMs": 9385,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "a busy city.",
    "startMs": 9410,
    "endMs": 10560,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Every day, shoppers walk by, browse a",
    "startMs": 10635,
    "endMs": 13025,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "little, and leave.",
    "startMs": 13075,
    "endMs": 14645,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Leo has clues: what they looked at,",
    "startMs": 14770,
    "endMs": 16895,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "what they almost bought, and how they",
    "startMs": 16920,
    "endMs": 18545,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "paid.",
    "startMs": 18595,
    "endMs": 19520,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "But those clues live in different places,",
    "startMs": 19595,
    "endMs": 22145,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "so every campaign is a guess.",
    "startMs": 22195,
    "endMs": 24545,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Who should he reach?",
    "startMs": 24620,
    "endMs": 25795,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "And what should he offer?",
    "startMs": 25870,
    "endMs": 27470,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
