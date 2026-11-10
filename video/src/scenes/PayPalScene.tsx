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
    "text": "Here's where PayPal closes the loop.",
    "startMs": 250,
    "endMs": 2825,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "In our demo, that exact order connects",
    "startMs": 2900,
    "endMs": 5275,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "to a PayPal Sandbox capture.",
    "startMs": 5325,
    "endMs": 7850,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "We can follow the purchase through the",
    "startMs": 7900,
    "endMs": 9475,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "payment, the processing fee, and what the",
    "startMs": 9525,
    "endMs": 12045,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "merchant receives.",
    "startMs": 12095,
    "endMs": 13645,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
