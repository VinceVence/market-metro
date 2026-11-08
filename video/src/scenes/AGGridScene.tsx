import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Evidence} from '../film/Evidence';
import '../video.css';
export const AGGridScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Evidence/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/ag_grid.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
        {"text": "A G Grid and A G Charts", "startMs": 250, "endMs": 1436, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "make every step inspectable.", "startMs": 1436, "endMs": 3598, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Compare models.", "startMs": 3598, "endMs": 4993, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Open the agent's evidence.", "startMs": 4993, "endMs": 7016, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Check the native PayPal receipt in our", "startMs": 7016, "endMs": 9247, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "custom widget.", "startMs": 9247, "endMs": 10573, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Even the dashboard layout is editable.", "startMs": 10573, "endMs": 13293, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "The story ends with a sale, and", "startMs": 13293, "endMs": 15037, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "a record you can verify.", "startMs": 15037, "endMs": 16850, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
