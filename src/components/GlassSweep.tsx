import React from "react";

export type GlassSweepProps = {
  posterUrl: string;
  title: string;
  subtitle?: string;
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

  return (
    <CardWrapper
      {...(href
        ? {
            href,
            className: `group relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-md shadow-lg hover:shadow-2xl transition-transform transition-shadow duration-300 hover:scale-105 ${
              className ?? ""
            }`,
          }
        : {
            className: `group relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-md shadow-lg hover:shadow-2xl transition-transform transition-shadow duration-300 hover:scale-105 ${
              className ?? ""
            }`,
          })}
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

        {/* Glass sweep animation target (inside overflow-hidden) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span
            data-glass-sweep
            className="absolute top-[-45%] left-[-60%] h-[190%] w-[45%] skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100"
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

      {/* Dedicated keyframe via inline style to keep component reusable */}
      <style>{`
        /* Glass sweep animation */
        .group:hover [data-glass-sweep] {
          animation: glass-sweep 650ms cubic-bezier(.2,.7,.2,1) both;
        }
        @keyframes glass-sweep {
          0% { transform: translateX(-120%) skewX(12deg); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateX(260%) skewX(12deg); opacity: 0; }
        }
      `}</style>

      {/* Mark the sheen element for animation */}

    </CardWrapper>
  );
};

export default GlassSweep;

