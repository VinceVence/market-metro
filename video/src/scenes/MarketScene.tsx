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
    "text": "People walk in.",
    "startMs": 250,
    "endMs": 1325,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "They look around.",
    "startMs": 1505,
    "endMs": 2630,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Then… they leave.",
    "startMs": 2730,
    "endMs": 4105,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "For Leo, it's becoming a familiar story.",
    "startMs": 5080,
    "endMs": 8100,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "He runs a furniture shop in a",
    "startMs": 8175,
    "endMs": 9550,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "busy neighborhood.",
    "startMs": 9600,
    "endMs": 10775,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The products are ready.",
    "startMs": 10825,
    "endMs": 12300,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The customers are out there.",
    "startMs": 12375,
    "endMs": 14200,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "But after days of trying to bring",
    "startMs": 14250,
    "endMs": 15625,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "them back, he's still guessing.",
    "startMs": 15650,
    "endMs": 17615,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Who should he reach?",
    "startMs": 17690,
    "endMs": 18840,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "And what should he offer?",
    "startMs": 18915,
    "endMs": 20365,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The clues are already there, in what",
    "startMs": 20415,
    "endMs": 22325,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "shoppers browse, what they ask about, and",
    "startMs": 22400,
    "endMs": 24825,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "what they buy.",
    "startMs": 24875,
    "endMs": 26200,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Leo just needs a way to connect",
    "startMs": 26300,
    "endMs": 27850,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "them.",
    "startMs": 27900,
    "endMs": 28600,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
