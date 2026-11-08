import {Audio} from '@remotion/media';
import {AbsoluteFill,staticFile,useVideoConfig} from 'remotion';
import {BasicCaptions} from '../basic-captions.element';
import {Meaning} from '../film/Meaning';
import '../video.css';
export const OntologyScene=()=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill>
    <Meaning/>
    <Audio name="Heart · upbeat neural female narration" src={staticFile("narration-neural/ontology.wav")} from={Math.round(.25*fps)} premountFor={fps}/>
    <div className="caption-layer">
      <BasicCaptions name="Narration captions" premountFor={fps} width={1440} combineTokensWithinMilliseconds={0} style={{position:"absolute",left:240,bottom:100}} captions={[
        {"text": "A single checkout can split into several", "startMs": 250, "endMs": 2325, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "merchant orders.", "startMs": 2375, "endMs": 3600, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "Our ontology keeps the meaning intact: one", "startMs": 3650, "endMs": 6300, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "purchase, counted once.", "startMs": 6350, "endMs": 8425, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "If the links are unclear, the system", "startMs": 8500, "endMs": 10400, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
        {"text": "holds the decision.", "startMs": 10450, "endMs": 11850, "timestampMs": null, "confidence": null, "pageBreakAfter": true},
      ]}/>
    </div>
  </AbsoluteFill>;
};
