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
        volume={0.45061845462256306}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(1.891 * fps)}
        volume={0.47021056134528316}
        premountFor={fps}
      />
      <Audio
        name="door · event"
        src={staticFile("music/door.wav")}
        from={Math.round(2.291 * fps)}
        volume={0.47021056134528316}
        premountFor={fps}
      />
      <Audio
        name="steps · event"
        src={staticFile("music/steps.wav")}
        from={Math.round(6.05 * fps)}
        volume={0.5387829348748037}
        premountFor={fps}
      />
      <Audio
        name="page · event"
        src={staticFile("music/page.wav")}
        from={Math.round(12.165 * fps)}
        volume={0.587763201681604}
        premountFor={fps}
      />
      <Audio
        name="page · event"
        src={staticFile("music/page.wav")}
        from={Math.round(12.965 * fps)}
        volume={0.5093947747907235}
        premountFor={fps}
      />
      <Audio
        name="page · event"
        src={staticFile("music/page.wav")}
        from={Math.round(13.765 * fps)}
        volume={0.4310263478998429}
        premountFor={fps}
      />
      <Audio
        name="pop · event"
        src={staticFile("music/pop.wav")}
        from={Math.round(16.884 * fps)}
        volume={0.5093947747907235}
        premountFor={fps}
      />
      <Audio
        name="pop · event"
        src={staticFile("music/pop.wav")}
        from={Math.round(17.64 * fps)}
        volume={0.5093947747907235}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(19.35 * fps)}
        volume={0.3428618676476023}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(21.825 * fps)}
        volume={0.23510528067264158}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(32.933 * fps)}
        volume={0.21551317394992145}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(43.9 * fps)}
        volume={0.293881600840802}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(63.467 * fps)}
        volume={0.2742894941180819}
        premountFor={fps}
      />
      <Audio
        name="notify · event"
        src={staticFile("music/notify.wav")}
        from={Math.round(68.992 * fps)}
        volume={0.3428618676476023}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(71.517 * fps)}
        volume={0.440822401261203}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(74.207 * fps)}
        volume={0.293881600840802}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(83.101 * fps)}
        volume={0.3918421344544027}
        premountFor={fps}
      />
      <Audio
        name="coin · event"
        src={staticFile("music/coin.wav")}
        from={Math.round(91.432 * fps)}
        volume={0.3232697609248822}
        premountFor={fps}
      />
      <Audio
        name="sweep · event"
        src={staticFile("music/sweep.wav")}
        from={Math.round(106.467 * fps)}
        volume={0.24490133403400166}
        premountFor={fps}
      />
      <Audio
        name="verified · event"
        src={staticFile("music/verified.wav")}
        from={Math.round(116.283 * fps)}
        volume={0.2742894941180819}
        premountFor={fps}
      />
    </>
  );
};
