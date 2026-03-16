"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [negative, setNegative] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.log(err);
        setError("Camera non disponibile o permesso negato");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <main className="app">
      <video
        ref={videoRef}
        className={`video ${negative ? "neg" : ""}`}
        autoPlay
        muted
        playsInline
      />

      <button
        className="toggle"
        onClick={() => setNegative((prev) => !prev)}
      >
        {negative ? "POSITIVE" : "NEGATIVE"}
      </button>

      {error && <div className="error">{error}</div>}
    </main>
  );
}