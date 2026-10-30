import Image from 'next/image';

// Flat green geometry in Azentio's style: bars, half circles, triangles, quarter arcs.
const G = '#2ED88E';
const SHAPES: React.ReactNode[] = [
  <g key="a" fill={G}>
    <rect x="16" y="26" width="16" height="120" />
    <rect x="42" y="26" width="16" height="120" />
    <rect x="68" y="26" width="16" height="120" />
    <path d="M16 300v-110a110 110 0 0 1 110 110z" />
    <path d="M300 40a60 60 0 0 1 100 0v60h-100z" opacity=".55" />
  </g>,
  <g key="b" fill={G}>
    <path d="M0 0h130a130 130 0 0 1-130 130z" />
    <rect x="20" y="170" width="110" height="18" />
    <rect x="20" y="198" width="80" height="18" />
    <path d="M20 300l60-100 60 100z" />
  </g>,
  <g key="c" fill={G}>
    <circle cx="70" cy="80" r="46" />
    <rect x="130" y="40" width="16" height="120" />
    <rect x="156" y="40" width="16" height="120" />
    <path d="M0 300h200a100 100 0 0 0-200 0z" opacity=".6" />
  </g>,
  <g key="d" fill={G}>
    <path d="M0 300V160l140 140z" />
    <rect x="18" y="30" width="110" height="18" />
    <rect x="18" y="58" width="76" height="18" />
    <rect x="18" y="86" width="44" height="18" />
    <circle cx="190" cy="250" r="34" opacity=".6" />
  </g>,
];

interface ShapePhotoProps {
  src: string;
  alt: string;
  /** 0-3 picks a different green geometry. */
  variant?: number;
  /** 'arch': portrait photo in an arch over the shapes. 'wide': full-bleed photo with a shape accent. */
  mode?: 'arch' | 'wide';
  className?: string;
  sizes?: string;
}

export default function ShapePhoto({ src, alt, variant = 0, mode = 'arch', className = '', sizes = '(min-width: 1024px) 40vw, 92vw' }: ShapePhotoProps) {
  const pos = className.includes('absolute') ? '' : 'relative';
  if (mode === 'wide') {
    return (
      <div className={`${pos} overflow-hidden bg-az-mint-tint ${className}`}>
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover transition-transform duration-500 group-hover:scale-105" />
        <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="xMinYMax slice" className="pointer-events-none absolute bottom-0 left-0 h-2/5 w-auto max-w-[45%]">
          {SHAPES[variant % SHAPES.length]}
        </svg>
      </div>
    );
  }
  return (
    <div className={`${pos} overflow-hidden bg-az-mint-tint ${className}`}>
      <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        {SHAPES[variant % SHAPES.length]}
      </svg>
      <div className="absolute bottom-0 right-[7%] h-[94%] max-h-[26rem] aspect-[3/4] overflow-hidden rounded-t-[999px] shadow-soft">
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover object-top transition-transform duration-500 group-hover:scale-105" />
      </div>
    </div>
  );
}

/** Flat green geometry only, no photo. Use for pages that have no suitable photograph. */
export function ShapeArt({ variant = 0, className = '' }: { variant?: number; className?: string }) {
  return (
    <div className={`${className.includes('absolute') ? '' : 'relative'} overflow-hidden bg-az-mint-tint ${className}`}>
      <svg aria-hidden viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        {SHAPES[variant % SHAPES.length]}
      </svg>
    </div>
  );
}
