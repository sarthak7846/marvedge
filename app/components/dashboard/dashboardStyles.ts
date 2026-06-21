import css from "styled-jsx/css";

// Scoped animation styles for the dashboard. Kept as a module-scope styled-jsx
// `css` block so the component function stays small; behavior is identical to an
// inline `<style jsx>` block.
export const dashboardAnimationStyles = css`
  @keyframes starBlink {
    0%,
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
    25% {
      transform: scale(0.8) rotate(90deg);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.2) rotate(180deg);
      opacity: 1;
    }
    75% {
      transform: scale(0.9) rotate(270deg);
      opacity: 0.8;
    }
  }

  .star-blink {
    animation: starBlink 2s ease-in-out infinite;
  }

  /* AI Orb Animations */
  .ai-orb-container {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2rem;
    animation: ai-orb-float 4s ease-in-out infinite;
    position: relative;
  }
  .ai-orb-svg {
    filter: drop-shadow(0 0 18px #bcb3f7);
    z-index: 1;
  }
  .ai-orb-main {
    filter: blur(0.5px);
    animation: ai-orb-pulse 2.5s ease-in-out infinite alternate;
  }
  .ai-orb-glow {
    filter: blur(10px);
    opacity: 0.6;
    animation: ai-orb-glow 3s ease-in-out infinite alternate;
  }
  .ai-orb-aura {
    stroke: #bcb3f7;
    opacity: 0.3;
    transform-origin: 50% 50%;
    animation: ai-orb-aura-expand 2.8s ease-in-out infinite;
  }
  @keyframes ai-orb-float {
    0% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-7px);
    }
    100% {
      transform: translateY(0);
    }
  }
  @keyframes ai-orb-pulse {
    0% {
      filter: blur(0.5px);
    }
    100% {
      filter: blur(2.5px);
    }
  }
  @keyframes ai-orb-glow {
    0% {
      opacity: 0.6;
    }
    100% {
      opacity: 0.9;
    }
  }
  @keyframes ai-orb-aura-expand {
    0% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 0.12;
      transform: scale(1.15);
    }
    100% {
      opacity: 0.3;
      transform: scale(1);
    }
  }
  /* Modern sparkles */
  .ai-orb-sparkle {
    opacity: 0.8;
    filter: blur(0.2px);
    transform-origin: 50% 50%;
    animation-timing-function: linear;
  }
  .sparkle1 {
    animation: sparkle-orbit1 3.2s linear infinite;
  }
  .sparkle2 {
    animation: sparkle-orbit2 2.7s linear infinite;
  }
  .sparkle3 {
    animation: sparkle-orbit3 2.9s linear infinite;
  }
  .sparkle4 {
    animation: sparkle-orbit4 3.4s linear infinite;
  }
  .sparkle5 {
    animation: sparkle-orbit5 2.8s linear infinite;
  }
  .sparkle6 {
    animation: sparkle-orbit6 3.3s linear infinite;
  }
  @keyframes sparkle-orbit1 {
    0% {
      transform: rotate(0deg) translate(30px) scale(1);
      opacity: 0.8;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: rotate(360deg) translate(30px) scale(1.1);
      opacity: 0.8;
    }
  }
  @keyframes sparkle-orbit2 {
    0% {
      transform: rotate(60deg) translate(25px) scale(1);
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: rotate(420deg) translate(25px) scale(1.1);
      opacity: 0.7;
    }
  }
  @keyframes sparkle-orbit3 {
    0% {
      transform: rotate(120deg) translate(28px) scale(1);
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: rotate(480deg) translate(28px) scale(1.1);
      opacity: 0.6;
    }
  }
  @keyframes sparkle-orbit4 {
    0% {
      transform: rotate(180deg) translate(32px) scale(1);
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: rotate(540deg) translate(32px) scale(1.1);
      opacity: 0.5;
    }
  }
  @keyframes sparkle-orbit5 {
    0% {
      transform: rotate(240deg) translate(26px) scale(1);
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: rotate(600deg) translate(26px) scale(1.1);
      opacity: 0.7;
    }
  }
  @keyframes sparkle-orbit6 {
    0% {
      transform: rotate(300deg) translate(29px) scale(1);
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: rotate(660deg) translate(29px) scale(1.1);
      opacity: 0.6;
    }
  }
`;
