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
  {
    "text": "Across this twelve store simulation, the campaign",
    "startMs": 250,
    "endMs": 3356,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "delivers sixteen extra retained purchases, over a",
    "startMs": 3356,
    "endMs": 6461,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "thousand dollars in merchant contribution, and three",
    "startMs": 6461,
    "endMs": 9783,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "point four seven percent more modeled PayPal",
    "startMs": 9783,
    "endMs": 12528,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  },
  {
    "text": "net.",
    "startMs": 12528,
    "endMs": 13250,
    "timestampMs": null,
    "confidence": null,
    "pageBreakAfter": true
  }
]}/>
    </div>
  </AbsoluteFill>;
};
