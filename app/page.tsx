"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [negative, setNegative] = useState(true);
  const [error, setError] = useState("");
  const [streamReady, setStreamReady] = useState(false);

  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  const [supportsExposure, setSupportsExposure] = useState(false);

  const [exposureMin, setExposureMin] = useState(-2);
  const [exposureMax, setExposureMax] = useState(2);
  const [exposureStep, setExposureStep] = useState(0.1);
  const [exposureValue, setExposureValue] = useState(0);

  // fallback visivo se la camera non supporta exposureCompensation
  const [fakeBrightness, setFakeBrightness] = useState(1);

  useEffect(() => {
    let localStream: MediaStream | null = null;

    async function startCamera() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        const videoTrack = localStream.getVideoTracks()[0];
        setTrack(videoTrack);

        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
          await videoRef.current.play();
          setStreamReady(true);
        }

        // Verifica capacità camera
        if (videoTrack && "getCapabilities" in videoTrack) {
          const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & {
            exposureCompensation?: { min: number; max: number; step?: number };
          };

          if (capabilities.exposureCompensation) {
            setSupportsExposure(true);
            setExposureMin(capabilities.exposureCompensation.min);
            setExposureMax(capabilities.exposureCompensation.max);
            setExposureStep(capabilities.exposureCompensation.step ?? 0.1);
            setExposureValue(0);
          }
        }
      } catch (err) {
        console.error(err);
        setError("Camera non disponibile o permesso negato");
      }
    }

    startCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function handleExposureChange(value: number) {
    setExposureValue(value);

    // Se il browser/device supporta exposureCompensation vera, proviamo ad applicarla
    if (track && supportsExposure) {
      try {
        await track.applyConstraints({
          advanced: [{ exposureCompensation: value } as any],
        });
        return;
      } catch (err) {
        console.warn("Exposure hardware non applicata, uso fallback visivo.", err);
      }
    }

    // fallback visivo
    // mappiamo da un range circa -2..2 a brightness 0.4..1.8
    const mapped = Math.max(0.4, Math.min(1.8, 1 + value * 0.4));
    setFakeBrightness(mapped);
  }

  async function takePhoto() {
    try {
      if (!videoRef.current) return;

      const video = videoRef.current;

      // Prova via ImageCapture se disponibile
      if (track && "ImageCapture" in window) {
        try {
          const imageCapture = new (window as Window & typeof globalThis & {
            ImageCapture: new (track: MediaStreamTrack) => {
              takePhoto: () => Promise<Blob>;
            };
          }).ImageCapture(track);

          const blob = await imageCapture.takePhoto();
          downloadBlob(blob, `negative-camera-${Date.now()}.jpg`);
          return;
        } catch (err) {
          console.warn("takePhoto non riuscito, uso canvas fallback.", err);
        }
      }

      // Fallback via canvas
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = video.videoWidth;
      const height = video.videoHeight;

      if (!width || !height) {
        setError("Video non pronto per lo scatto");
        return;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Disegniamo il frame
      ctx.filter = `${negative ? "invert(1)" : "invert(0)"} brightness(${fakeBrightness})`;
      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          downloadBlob(blob, `negative-camera-${Date.now()}.jpg`);
        },
        "image/jpeg",
        0.95
      );
    } catch (err) {
      console.error(err);
      setError("Errore durante lo scatto della foto");
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const videoFilter = `${negative ? "invert(1)" : "invert(0)"} brightness(${fakeBrightness})`;

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: "black",
        overflow: "hidden",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: videoFilter,
          background: "black",
        }}
      />

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 24,
          zIndex: 20,
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            padding: 14,
            borderRadius: 18,
            color: "white",
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 14,
              marginBottom: 8,
              fontWeight: 700,
            }}
          >
            EXPOSURE {supportsExposure ? "(camera)" : "(visual fallback)"}:{" "}
            {exposureValue.toFixed(2)}
          </label>

          <input
            type="range"
            min={exposureMin}
            max={exposureMax}
            step={exposureStep}
            value={exposureValue}
            onChange={(e) => handleExposureChange(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <button
            onClick={() => setNegative((prev) => !prev)}
            style={buttonStyle}
          >
            {negative ? "POSITIVE" : "NEGATIVE"}
          </button>

          <button
            onClick={takePhoto}
            disabled={!streamReady}
            style={{
              ...buttonStyle,
              opacity: streamReady ? 1 : 0.5,
            }}
          >
            SCATTA
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            right: 20,
            zIndex: 30,
            color: "white",
            textAlign: "center",
            background: "rgba(180,0,0,0.75)",
            padding: "10px 14px",
            borderRadius: 12,
          }}
        >
          {error}
        </div>
      )}
    </main>
  );
}

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  padding: "16px 18px",
  fontSize: 15,
  fontWeight: 800,
  background: "white",
  color: "black",
  cursor: "pointer",
};