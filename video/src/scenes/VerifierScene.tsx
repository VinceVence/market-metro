import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Testing} from '../film/Testing';
import '../video.css';
export const VerifierScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Testing/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/verifier.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
        {"text": "The planner preferred one model.", "startMs": 250, "endMs": 2225, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "The verifier tested both rankings on separate", "startMs": 2300, "endMs": 4900, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "trial markets.", "startMs": 4950, "endMs": 6275, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Boosted trees earned more while protecting merchant", "startMs": 6375, "endMs": 8750, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "outcomes, so it became the selected model.", "startMs": 8800, "endMs": 11625, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Measure first.", "startMs": 11725, "endMs": 12825, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Then launch.", "startMs": 12900, "endMs": 13950, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
