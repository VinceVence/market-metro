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
    "text": "And the money leaves a trail.",
    "startMs": 250,
    "endMs": 2293,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "PayPal Sandbox captures that exact order: ninety",
    "startMs": 2293,
    "endMs": 5153,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "six dollars gross, the provider fee and",
    "startMs": 5153,
    "endMs": 7400,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "the merchant's proceeds.",
    "startMs": 7400,
    "endMs": 9307,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Each record links back to the warehouse",
    "startMs": 9307,
    "endMs": 11555,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "order, so the proof is traceable without",
    "startMs": 11555,
    "endMs": 13870,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "double counting.",
    "startMs": 13870,
    "endMs": 15300,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
