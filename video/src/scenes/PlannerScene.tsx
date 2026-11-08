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
  {
    "text": "With that evidence, the agent examines demand",
    "startMs": 250,
    "endMs": 3089,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "and stock, chooses twenty eight days of",
    "startMs": 3089,
    "endMs": 5491,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "training data, and asks local tools to",
    "startMs": 5491,
    "endMs": 7820,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "fit two models for a reactivation campaign.",
    "startMs": 7820,
    "endMs": 10950,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
