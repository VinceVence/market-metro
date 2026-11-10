import {Audio} from "@remotion/media";
import {staticFile,useVideoConfig} from "remotion";
export const Soundtrack=()=>{const {fps}=useVideoConfig();return <>
  <Audio name="Upbeat original score · 120 BPM · voice ducking" src={staticFile("music/upbeat-score.mp3")} volume={1} premountFor={fps}/>
  <Audio name="thump · event" src={staticFile("music/thump.wav")} from={Math.round(0.625*fps)} volume={0.45} premountFor={fps}/>
  <Audio name="thump · event" src={staticFile("music/thump.wav")} from={Math.round(2.685*fps)} volume={0.5} premountFor={fps}/>
  <Audio name="thump · event" src={staticFile("music/thump.wav")} from={Math.round(3.585*fps)} volume={0.55} premountFor={fps}/>
  <Audio name="riser · event" src={staticFile("music/riser.wav")} from={Math.round(6.285*fps)} volume={0.32} premountFor={fps}/>
  <Audio name="hit · event" src={staticFile("music/hit.wav")} from={Math.round(7.835*fps)} volume={0.42} premountFor={fps}/>
  <Audio name="steps · event" src={staticFile("music/steps.wav")} from={Math.round(11.835*fps)} volume={0.4} premountFor={fps}/>
  <Audio name="page · event" src={staticFile("music/page.wav")} from={Math.round(10.635*fps)} volume={0.6} premountFor={fps}/>
  <Audio name="pop · event" src={staticFile("music/pop.wav")} from={Math.round(24.17*fps)} volume={0.52} premountFor={fps}/>
  <Audio name="pop · event" src={staticFile("music/pop.wav")} from={Math.round(25.52*fps)} volume={0.52} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(27.483*fps)} volume={0.35} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(30.443*fps)} volume={0.24} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(47.3*fps)} volume={0.22} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(92.206*fps)} volume={0.28} premountFor={fps}/>
  <Audio name="notify · event" src={staticFile("music/notify.wav")} from={Math.round(98.242*fps)} volume={0.35} premountFor={fps}/>
  <Audio name="coin · event" src={staticFile("music/coin.wav")} from={Math.round(103.592*fps)} volume={0.45} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(106.272*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(114.611*fps)} volume={0.4} premountFor={fps}/>
  <Audio name="coin · event" src={staticFile("music/coin.wav")} from={Math.round(130.014*fps)} volume={0.33} premountFor={fps}/>
  <Audio name="verified · event" src={staticFile("music/verified.wav")} from={Math.round(161.483*fps)} volume={0.28} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(27.283*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(45.2*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(65.3*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(81.267*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(96.267*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(111.333*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(126.767*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(146.9*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="station · event" src={staticFile("music/station.wav")} from={Math.round(161.233*fps)} volume={0.3} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(44.15*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(46.0*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(64.25*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(66.1*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(80.217*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(82.067*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(95.217*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(97.067*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(110.283*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(112.133*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(125.717*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(127.567*fps)} volume={0.18} premountFor={fps}/>
  <Audio name="arrive · event" src={staticFile("music/arrive.wav")} from={Math.round(145.85*fps)} volume={0.2} premountFor={fps}/>
  <Audio name="depart · event" src={staticFile("music/depart.wav")} from={Math.round(147.7*fps)} volume={0.18} premountFor={fps}/>
</>;};
