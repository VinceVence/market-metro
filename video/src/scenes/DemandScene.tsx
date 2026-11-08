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
        {"text": "Shopper one seventy nine has not bought", "startMs": 250, "endMs": 2231, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "in sixteen days.", "startMs": 2231, "endMs": 3432, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Which product would bring them back?", "startMs": 3432, "endMs": 5653, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "And how can a merchant know the", "startMs": 5653, "endMs": 7154, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "next campaign will be worth it?", "startMs": 7154, "endMs": 9075, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
