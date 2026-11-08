import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Planning} from '../film/Planning';
import '../video.css';
export const PlannerScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Planning/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/planner.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
        {"text": "Market Metro turns those questions into a", "startMs": 250, "endMs": 2525, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "plan.", "startMs": 2575, "endMs": 3500, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "The language model investigates demand, chooses twenty", "startMs": 3575, "endMs": 6950, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "eight days of history, and requests two", "startMs": 6975, "endMs": 9260, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "model fits.", "startMs": 9310, "endMs": 10510, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "It proposes recommendations and shopping needs inquiries", "startMs": 10585, "endMs": 13810, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "for consenting shoppers.", "startMs": 13860, "endMs": 15610, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Every choice is recorded, and every campaign", "startMs": 15685, "endMs": 18460, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "must pass a financial test.", "startMs": 18510, "endMs": 20485, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
