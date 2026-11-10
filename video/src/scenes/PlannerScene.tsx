import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Planning} from '../film/Planning';
import '../video.css';
export const PlannerScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Planning/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/planner.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "With that map, the agent studies demand",
    "startMs": 250,
    "endMs": 2575,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "and stock, selects twenty eight days of",
    "startMs": 2650,
    "endMs": 4950,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "history, and asks local tools to train",
    "startMs": 5000,
    "endMs": 7575,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "two models.",
    "startMs": 7650,
    "endMs": 8925,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Every choice is saved in a checkpoint.",
    "startMs": 9000,
    "endMs": 11425,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
