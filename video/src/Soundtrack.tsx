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
        volume={0.43579967162745775}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(1.891 * fps)}
        volume={0.45474748343734717}
        premountFor={fps}
      />
      <Audio
        name="door · event"
        src={staticFile("music/door.wav")}
        from={Math.round(2.291 * fps)}
        volume={0.45474748343734717}
        premountFor={fps}
      />
      <Audio
        name="steps · event"
        src={staticFile("music/steps.wav")}
        from={Math.round(6.05 * fps)}
        volume={0.5210648247719604}
        premountFor={fps}
      />
      <Audio
        name="page · event"
        src={staticFile("music/page.wav")}
        from={Math.round(12.165 * fps)}
        volume={0.568434354296684}
        premountFor={fps}
      />
      <Audio
        name="page · event"
        src={staticFile("music/page.wav")}
        from={Math.round(12.965 * fps)}
        volume={0.4926431070571261}
        premountFor={fps}
      />
      <Audio
        name="page · event"
        src={staticFile("music/page.wav")}
        from={Math.round(13.765 * fps)}
        volume={0.4168518598175682}
        premountFor={fps}
      />
      <Audio
        name="pop · event"
        src={staticFile("music/pop.wav")}
        from={Math.round(16.884 * fps)}
        volume={0.4926431070571261}
        premountFor={fps}
      />
      <Audio
        name="pop · event"
        src={staticFile("music/pop.wav")}
        from={Math.round(17.64 * fps)}
        volume={0.4926431070571261}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(19.35 * fps)}
        volume={0.3315867066730656}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(21.825 * fps)}
        volume={0.22737374171867358}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(39.367 * fps)}
        volume={0.2084259299087841}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(49.567 * fps)}
        volume={0.284217177148342}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(69.133 * fps)}
        volume={0.2652693653384525}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(74.658 * fps)}
        volume={0.3315867066730656}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(77.183 * fps)}
        volume={0.42632576572251296}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(79.873 * fps)}
        volume={0.284217177148342}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(88.768 * fps)}
        volume={0.37895623619778934}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(97.099 * fps)}
        volume={0.3126388948631762}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(112.133 * fps)}
        volume={0.23684764762361832}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(121.95 * fps)}
        volume={0.2652693653384525}
        premountFor={fps}
      />
    </>
  );
};
