import soundMix from '../../public/music/sound-design.json';
import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Ending} from '../film/Ending';
import '../video.css';
export const ClosingScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Ending/>
    <Audio volume={soundMix.masterGain} name="Heart · upbeat neural female narration" src={staticFile("narration-mix/close.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:48}} captions={[
  {
    "text": "For merchants like Leo, those two questions",
    "startMs": 250,
    "endMs": 2525,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "now have tested answers.",
    "startMs": 2575,
    "endMs": 4475,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Market Metro.",
    "startMs": 4575,
    "endMs": 5775,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "Agentic commerce that learns, tests its ideas,",
    "startMs": 5850,
    "endMs": 8825,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "and shows its work.",
    "startMs": 8885,
    "endMs": 10210,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
