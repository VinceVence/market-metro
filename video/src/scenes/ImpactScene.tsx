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
    "text": "So, what changed?",
    "startMs": 250,
    "endMs": 1734,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Across the same market, sixteen more purchases",
    "startMs": 1734,
    "endMs": 4560,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "were completed and kept.",
    "startMs": 4560,
    "endMs": 6467,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Payment volume grows by two thousand three",
    "startMs": 6467,
    "endMs": 9011,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "hundred forty five dollars.",
    "startMs": 9011,
    "endMs": 11130,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Merchant contribution and modeled PayPal net both",
    "startMs": 11130,
    "endMs": 14168,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "rise, even after AI cost.",
    "startMs": 14168,
    "endMs": 16076,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Every number is measured against the same",
    "startMs": 16076,
    "endMs": 18549,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "fixed rules.",
    "startMs": 18549,
    "endMs": 19750,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
