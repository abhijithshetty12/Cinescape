import React from "react";

export type GlassSweepProps = {
  posterUrl: string;
  title: string;
  subtitle?: React.ReactNode;
  href?: string;
  className?: string;

};

const GlassSweep: React.FC<GlassSweepProps> = ({
  posterUrl,
  title,
  subtitle,
  href,
  className,
}) => {
  const CardWrapper: React.ElementType = href ? "a" : "div";

  // Consolidate classes to avoid redundant code blocks
  const baseClasses = `group relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-md shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 ${
    className ?? ""
  }`;

  return (
    <CardWrapper
      {...(href ? { href, className: baseClasses } : { className: baseClasses })}
      aria-label={title}
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <img
          src={posterUrl}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Glass sweep animation target */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <span
            data-glass-sweep
            /* Changed left-[-60%] to left-[-100%] to park it completely out of bounds */
            className="absolute top-[-45%] left-[-100%] h-[190%] w-[45%] bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0"
          />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm md:text-base leading-snug truncate">
              {title}
            </div>
            {subtitle ? (
              <div className="text-gray-300 text-xs md:text-sm mt-1 truncate">
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Optimized keyframes */}
      <style>{`
        .group:hover [data-glass-sweep] {
          animation: glass-sweep 750ms cubic-bezier(.2, .7, .2, 1) both;
        }
        @keyframes glass-sweep {
          0% { 
            transform: translateX(0%) skewX(15deg); 
            opacity: 0; 
          }
          15% { 
            opacity: 1; 
          }
          90% {
            opacity: 1;
          }
          100% { 
            transform: translateX(400%) skewX(15deg); 
            opacity: 0; 
          }
        }
      `}</style>
    </CardWrapper>
  );
};

export default GlassSweep;