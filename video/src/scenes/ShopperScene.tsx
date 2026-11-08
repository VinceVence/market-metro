import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Return} from '../film/Return';
import '../video.css';
export const ShopperScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Return/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/shopper.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
        {"text": "On day thirty five, the recommendation meets", "startMs": 250, "endMs": 2996, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "a need in the simulation.", "startMs": 2996, "endMs": 4946, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Our quiet shopper chooses a mobile side", "startMs": 4946, "endMs": 7330, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "table from Form and Function, pays ninety", "startMs": 7330, "endMs": 9859, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "six dollars, and receives it the next", "startMs": 9859, "endMs": 12099, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "day.", "startMs": 12099, "endMs": 12822, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Under fixed rules, that request went unfilled.", "startMs": 12822, "endMs": 16145, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
