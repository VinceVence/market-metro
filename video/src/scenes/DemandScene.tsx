import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Quiet} from '../film/Quiet';
import '../video.css';
export const DemandScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Quiet/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/problem.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
  {
    "text": "In our simulated market, this shopper hasn't",
    "startMs": 250,
    "endMs": 2775,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "bought for sixteen days.",
    "startMs": 2825,
    "endMs": 4600,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Sending everyone a discount is easy, but",
    "startMs": 4700,
    "endMs": 7325,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "finding a recommendation worth sending takes evidence.",
    "startMs": 7400,
    "endMs": 10725,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
