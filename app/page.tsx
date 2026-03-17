"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [negative, setNegative] = useState(true);
  const [error, setError] = useState("");
  const [streamReady, setStreamReady] = useState(false);
  const [showExposure, setShowExposure] = useState(false);  
  
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

    // Disegna il frame video "pulito"
    ctx.drawImage(video, 0, 0, width, height);

    // Legge i pixel del canvas
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // fakeBrightness: 1 = normale
    // esempio: 0.8 più scuro, 1.2 più chiaro
    const brightness = fakeBrightness;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Applica brightness
      r = Math.max(0, Math.min(255, r * brightness));
      g = Math.max(0, Math.min(255, g * brightness));
      b = Math.max(0, Math.min(255, b * brightness));

      // Applica negativo se attivo
      if (negative) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    // Rimette i pixel modificati nel canvas
    ctx.putImageData(imageData, 0, 0);

    // Esporta JPG
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

      <>
  {/* Colonna destra controlli */}
  <div
    style={{
      position: "absolute",
      right: 16,
      bottom: 110,
      zIndex: 30,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
    }}
  >
    {/* Slider esposizione, visibile solo quando aperto */}
    {showExposure && (
  <div
    style={{
      width: 74,
      height: 240,
      borderRadius: 999,
      background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(10px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px 0",
      boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
    }}
  >
    <input
      type="range"
      min={exposureMin}
      max={exposureMax}
      step={exposureStep}
      value={exposureValue}
      onChange={(e) => handleExposureChange(Number(e.target.value))}
      style={{
        writingMode: "vertical-lr",
        WebkitAppearance: "slider-vertical",
        width: 38,
        height: 180,
        touchAction: "none",
      }}
    />
  </div>
)}

    {/* Bottone esposizione */}
    <button
      onClick={() => setShowExposure((prev) => !prev)}
      style={sideButtonStyle}
      aria-label="Esposizione"
      title="Esposizione"
    >
      ☀
    </button>

    {/* Bottone negativo/positivo */}
    <button
      onClick={() => setNegative((prev) => !prev)}
      style={sideButtonStyle}
      aria-label="Negativo positivo"
      title="Negativo / Positivo"
    >
      ◐
    </button>
  </div>

  {/* Pulsante scatto in basso al centro */}
  <div
    style={{
      position: "absolute",
      left: "50%",
      bottom: 28,
      transform: "translateX(-50%)",
      zIndex: 30,
    }}
  >
    <button
      onClick={takePhoto}
      disabled={!streamReady}
      aria-label="Scatta foto"
      title="Scatta foto"
      style={{
        width: 78,
        height: 78,
        borderRadius: "50%",
        border: "4px solid rgba(255,255,255,0.95)",
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        opacity: streamReady ? 1 : 0.45,
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <span
        style={{
          width: 58,
          height: 58,
          borderRadius: "50%",
          background: "white",
          display: "block",
        }}
      />
    </button>
  </div>
</>
    </main>
  );
}

const sideButtonStyle: React.CSSProperties = {
  width: 54,
  height: 54,
  border: "none",
  borderRadius: "50%",
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(10px)",
  color: "white",
  fontSize: 22,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
};