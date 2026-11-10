import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Return} from '../film/Return';
import '../video.css';
export const ShopperScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Return/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/shopper.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "Now follow one recommendation.",
    "startMs": 250,
    "endMs": 2675,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "On day thirty five, it reaches a",
    "startMs": 2750,
    "endMs": 4575,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "shopper who's been quiet for sixteen days.",
    "startMs": 4700,
    "endMs": 7525,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "They buy a ninety six dollar side",
    "startMs": 7575,
    "endMs": 9450,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "table.",
    "startMs": 9500,
    "endMs": 10250,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "It arrives tomorrow.",
    "startMs": 10325,
    "endMs": 11825,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Under fixed rules, that request went unfilled.",
    "startMs": 11875,
    "endMs": 15075,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
