import { Audio } from "@remotion/media";
import { staticFile, useVideoConfig } from "remotion";
export const Soundtrack = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <Audio
        name="Upbeat original score · 120 BPM · voice ducking"
        src={staticFile("music/upbeat-score.mp3")}
        volume={1}
        premountFor={fps}
      />
      <Audio
        name="birds · event"
        src={staticFile("music/birds.wav")}
        from={Math.round(0.15 * fps)}
        volume={0.354521796327227}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(3.43 * fps)}
        volume={0.37318083823918635}
        premountFor={fps}
      />
      <Audio
        name="door · event"
        src={staticFile("music/door.wav")}
        from={Math.round(4.15 * fps)}
        volume={0.37318083823918635}
        premountFor={fps}
      />
      <Audio
        name="steps · event"
        src={staticFile("music/steps.wav")}
        from={Math.round(4.096 * fps)}
        volume={0.37318083823918635}
        premountFor={fps}
      />
      <Audio
        name="page · event"
        src={staticFile("music/page.wav")}
        from={Math.round(5.186 * fps)}
        volume={0.5597712573587794}
        premountFor={fps}
      />
      <Audio
        name="pop · event"
        src={staticFile("music/pop.wav")}
        from={Math.round(6.274 * fps)}
        volume={0.4851350897109422}
        premountFor={fps}
      />
      <Audio
        name="pop · event"
        src={staticFile("music/pop.wav")}
        from={Math.round(7.557 * fps)}
        volume={0.4851350897109422}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(9.683 * fps)}
        volume={0.326533233459288}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(12.158 * fps)}
        volume={0.22390850294351178}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(22.833 * fps)}
        volume={0.20524946103155248}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(29.433 * fps)}
        volume={0.2798856286793897}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(41.936 * fps)}
        volume={0.26122658676743044}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(47.3 * fps)}
        volume={0.326533233459288}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(48.05 * fps)}
        volume={0.4198284430190846}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(50.1 * fps)}
        volume={0.2798856286793897}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(57.467 * fps)}
        volume={0.37318083823918635}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(66.081 * fps)}
        volume={0.3078741915473287}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(78.367 * fps)}
        volume={0.23323802389949144}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(88.05 * fps)}
        volume={0.26122658676743044}
        premountFor={fps}
      />
    </>
  );
};
