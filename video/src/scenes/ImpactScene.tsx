import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Results} from '../film/Results';
import '../video.css';
export const ImpactScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Results/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/impact.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
        {"text": "Across the twelve store market, this campaign", "startMs": 250, "endMs": 3030, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "delivered sixteen extra retained purchases.", "startMs": 3030, "endMs": 6237, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Merchant contribution grew by over a thousand", "startMs": 6237, "endMs": 9017, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "dollars.", "startMs": 9017, "endMs": 10015, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Modeled PayPal net rose three point four", "startMs": 10015, "endMs": 12438, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "seven percent after model cost.", "startMs": 12438, "endMs": 14790, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "These are simulated results, not production profit.", "startMs": 14790, "endMs": 18425, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
