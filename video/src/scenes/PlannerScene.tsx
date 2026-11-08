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
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-neural/planner.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "Now follow one saved reactivation campaign.",
    "startMs": 250,
    "endMs": 3475,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "The agent analyzes demand, chooses twenty eight",
    "startMs": 3525,
    "endMs": 6575,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "days of history, and fits two models.",
    "startMs": 6625,
    "endMs": 9325,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "A verifier tests the campaign before it",
    "startMs": 9400,
    "endMs": 11500,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "reaches shoppers.",
    "startMs": 11550,
    "endMs": 12875,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
