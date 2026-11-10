import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Payment} from '../film/Payment';
import '../video.css';
export const PayPalScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Payment/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/paypal.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "That purchase connects to PayPal Sandbox.",
    "startMs": 250,
    "endMs": 3259,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "It captures the same ninety six dollar",
    "startMs": 3259,
    "endMs": 5551,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "order, showing the fee and merchant proceeds.",
    "startMs": 5551,
    "endMs": 8775,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Each record links back to the warehouse,",
    "startMs": 8775,
    "endMs": 11211,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "so one purchase is counted once.",
    "startMs": 11211,
    "endMs": 13575,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
