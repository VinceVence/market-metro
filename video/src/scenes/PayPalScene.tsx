import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Payment} from '../film/Payment';
import '../video.css';
export const PayPalScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Payment/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/paypal.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
  {
    "text": "We mirror that order once through PayPal",
    "startMs": 250,
    "endMs": 2584,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Sandbox.",
    "startMs": 2584,
    "endMs": 3544,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The completed capture records the fee and",
    "startMs": 3544,
    "endMs": 5947,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "merchant proceeds, then returns a receipt that",
    "startMs": 5947,
    "endMs": 8692,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "links all the way back to the",
    "startMs": 8692,
    "endMs": 10270,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "purchase.",
    "startMs": 10270,
    "endMs": 11300,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
