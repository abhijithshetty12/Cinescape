import React from "react";

const License: React.FC = () => (
  <footer
    className="fixed left-0 bottom-0 w-full flex justify-end items-end px-2 pb-1 z-[9999] pointer-events-none select-none"
    style={{
      background: "none",
      fontFamily: "Montserrat, Inter, Arial, sans-serif",
      fontWeight: 600,
      fontSize: "0.68rem",
      letterSpacing: "0.07em",
      color: "#fff",
      textShadow: "0 1px 4px #0006, 0 0 2px #fff2",
      opacity: 0.6,
      userSelect: "none",
      pointerEvents: "none",
    }}
  >
    <span
      style={{
        background: "linear-gradient(90deg, #facc15 10%, #f472b6 90%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        fontWeight: 600,
        fontSize: "0.58rem",
        letterSpacing: "0.13em",
        textTransform: "uppercase",
        marginRight: "0.22em",
        filter: "drop-shadow(0 1px 2px #facc1555)",
        padding: "0.06em 0.32em",
        borderRadius: "0.5em",
        backdropFilter: "blur(2.5px)",
        WebkitBackdropFilter: "blur(2.5px)",
        opacity: 0.8,
        transition: "background 0.2s, box-shadow 0.2s",
        backgroundColor: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      Abhijith
    </span>
    <span className="text-gray-200/80 font-medium tracking-wide" style={{ fontSize: "0.68rem" }}>
      &copy; {new Date().getFullYear()}
    </span>
  </footer>
);

export default License;