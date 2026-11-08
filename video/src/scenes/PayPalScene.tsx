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
        {"text": "That exact order was mirrored once through", "startMs": 250, "endMs": 2375, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "PayPal Sandbox.", "startMs": 2450, "endMs": 2975, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "A completed ninety six dollar capture.", "startMs": 3025, "endMs": 5750, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Three fifty six in fees, and ninety", "startMs": 5800, "endMs": 8710, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "two forty four for the test merchant.", "startMs": 8760, "endMs": 11485, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "One order, one receipt, linked back to", "startMs": 11585, "endMs": 14085, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "the warehouse.", "startMs": 14110, "endMs": 15160, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
