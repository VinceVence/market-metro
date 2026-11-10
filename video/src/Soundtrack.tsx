import {Audio} from "@remotion/media";
import {staticFile,useVideoConfig} from "remotion";
export const Soundtrack=()=>{const {fps}=useVideoConfig();return <>
  <Audio name="Upbeat original score · 120 BPM · voice ducking" src={staticFile("music/upbeat-score.mp3")} volume={1} premountFor={fps}/>
  <Audio name="thump · event" src={staticFile("music/thump.wav")} from={Math.round(0.575*fps)} volume={0.45} premountFor={fps}/>
  <Audio name="thump · event" src={staticFile("music/thump.wav")} from={Math.round(1.605*fps)} volume={0.5} premountFor={fps}/>
  <Audio name="thump · event" src={staticFile("music/thump.wav")} from={Math.round(3.18*fps)} volume={0.55} premountFor={fps}/>
  <Audio name="riser · event" src={staticFile("music/riser.wav")} from={Math.round(4.955*fps)} volume={0.32} premountFor={fps}/>
  <Audio name="hit · event" src={staticFile("music/hit.wav")} from={Math.round(6.505*fps)} volume={0.42} premountFor={fps}/>
  <Audio name="steps · event" src={staticFile("music/steps.wav")} from={Math.round(12.5*fps)} volume={0.4} premountFor={fps}/>
  <Audio name="page · event" src={staticFile("music/page.wav")} from={Math.round(20.565*fps)} volume={0.6} premountFor={fps}/>
  <Audio name="pop · event" src={staticFile("music/pop.wav")} from={Math.round(17.24*fps)} volume={0.52} premountFor={fps}/>
  <Audio name="pop · event" src={staticFile("music/pop.wav")} from={Math.round(18.565*fps)} volume={0.52} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(29.583*fps)} volume={0.35} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(34.408*fps)} volume={0.24} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(46.2*fps)} volume={0.22} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(85.275*fps)} volume={0.28} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(95.067*fps)} volume={0.35} premountFor={fps}/>
  <Audio name="coin · event" src={staticFile("music/coin.wav")} from={Math.round(100.067*fps)} volume={0.45} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(102.067*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(115.158*fps)} volume={0.4} premountFor={fps}/>
  <Audio name="coin · event" src={staticFile("music/coin.wav")} from={Math.round(125.184*fps)} volume={0.33} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(150.35*fps)} volume={0.28} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(29.383*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(44.1*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(67.567*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(76.3*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(87.367*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(106.833*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(121.633*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(141.267*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(150.1*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(43.05*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(44.9*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(66.517*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(68.367*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(75.25*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(77.1*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(86.317*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(88.167*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(105.783*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(107.633*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(120.583*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(122.433*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(140.217*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(142.067*fps)} volume={0.18} premountFor={fps}/>
</>;};
