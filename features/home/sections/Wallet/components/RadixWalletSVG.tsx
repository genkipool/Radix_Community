/**
 * Radix Wallet SVG component.
 * All wallet UI colors are the original Radix design.
 * Only background gradient auras adapt to the site theme via CSS variables.
 *
 * Props:
 * - x / y: translate position within the parent container
 * - scale: uniform scale factor (default 1)
 * - className: extra CSS classes
 */
interface RadixWalletSVGProps {
  className?: string;
  x?: number;
  y?: number;
  scale?: number;
}

export default function RadixWalletSVG({ className = '', x = 0, y = 80, scale = 1 }: RadixWalletSVGProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 850 900"
      className={className}
      style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}
    >
      <defs>
        {/* Auras and Blurs */}
        <filter id="w-aura" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="70" />
        </filter>
        <filter id="w-sh-l" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="0" dy="12" stdDeviation="35" floodColor="#071526" floodOpacity="0.1" />
        </filter>
        <filter id="w-sh-r" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="0" dy="8" stdDeviation="25" floodColor="#071526" floodOpacity="0.08" />
        </filter>
        <filter id="w-tkt" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#071526" floodOpacity="0.04" />
        </filter>
        <filter id="w-crd" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="6" stdDeviation="15" floodColor="var(--color-text-main)" floodOpacity="0.12" />
        </filter>

        {/* Original Gradients */}
        <linearGradient id="w-gt" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00829f" />
          <stop offset="100%" stopColor="#00e5a3" />
        </linearGradient>
        <linearGradient id="w-gp" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6928cf" />
          <stop offset="100%" stopColor="#da48ef" />
        </linearGradient>
        <linearGradient id="w-gb" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#006aff" />
          <stop offset="100%" stopColor="#00ccff" />
        </linearGradient>

        <clipPath id="w-clip">
          <rect width="360" height="740" rx="45" />
        </clipPath>

        {/* Status Bar */}
        <g id="w-sb">
          <text x="35" y="32" fontSize="15" fontWeight="600" fill="var(--color-text-main)">9:29</text>
          {/* Icons shifted left by 25px, and down 2.5px for vertical center alignment with text */}
          <g transform="translate(-25, 2.5)">
            {/* Cellular */}
            <rect x="280" y="24" width="3" height="5" rx="1.5" fill="var(--color-text-main)" />
            <rect x="287" y="20" width="3" height="9" rx="1.5" fill="var(--color-text-main)" />
            <rect x="294" y="15" width="3" height="14" rx="1.5" fill="var(--color-text-main)" />
            {/* Wifi - Gap 12px from Cellular */}
            <path d="M 309 20 A 8 8 0 0 1 319 20 M 311 24 A 4 4 0 0 1 317 24 M 314 28 A 1 1 0 0 1 314.1 28" stroke="var(--color-text-main)" strokeWidth="2" strokeLinecap="round" fill="none" />
            {/* Battery - Gap 12px from Wifi */}
            <rect x="331" y="16" width="22" height="12" rx="4" stroke="var(--color-text-main)" strokeWidth="1.5" fill="none" />
            <rect x="333" y="18" width="14" height="8" rx="2" fill="var(--color-text-main)" />
            <path d="M 355 20 L 355 24" stroke="var(--color-text-main)" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </g>
      </defs>

      {/* Transform wrapper for position and scale */}
      <g transform={`translate(${x}, ${y}) scale(${scale})`}>

        {/* Background Auras — ONLY these use CSS variables for theme adaptation */}
        <ellipse cx="180" cy="180" rx="220" ry="240" fill="var(--color-primary, #ff9df0)" filter="url(#w-aura)" opacity="0" />
        <ellipse cx="650" cy="250" rx="240" ry="260" fill="var(--color-accent, #c789ff)" filter="url(#w-aura)" opacity="0" />
        <ellipse cx="250" cy="780" rx="230" ry="200" fill="var(--color-secondary, #7affd9)" filter="url(#w-aura)" opacity="0" />
        <ellipse cx="750" cy="650" rx="200" ry="220" fill="var(--color-primary, #99c6ff)" filter="url(#w-aura)" opacity="0" />        {/* ====== RIGHT PHONE — RADIX WALLET ====== */}
        <g transform="translate(455, 80) scale(0.92)">
          <rect width="360" height="740" rx="45" fill="var(--color-bg)" stroke="var(--color-card-border)" strokeWidth="3" filter="url(#w-sh-r)" />
          <g clipPath="url(#w-clip)">
            <use href="#w-sb" />
            <text x="25" y="110" fontSize="26" fontWeight="700" fill="var(--color-text-main)">Radix Wallet</text>

            {/* Gear Icon - Setttings */}
            <g transform="translate(307, 84) scale(1.1)" fillRule="evenodd" clipRule="evenodd" fill="var(--color-text-main)">
              <path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5M9.75 12a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0" />
              <path d="M11.975 1.25c-.445 0-.816 0-1.12.02a2.8 2.8 0 0 0-.907.19 2.75 2.75 0 0 0-1.489 1.488c-.145.35-.184.72-.2 1.122a.87.87 0 0 1-.415.731.87.87 0 0 1-.841-.005c-.356-.188-.696-.339-1.072-.389a2.75 2.75 0 0 0-2.033.545 2.8 2.8 0 0 0-.617.691c-.17.254-.356.575-.578.96l-.025.044c-.223.385-.408.706-.542.98-.14.286-.25.568-.29.88a2.75 2.75 0 0 0 .544 2.033c.231.301.532.52.872.734a.87.87 0 0 1 .426.726.87.87 0 0 1-.426.726c-.34.214-.64.433-.872.734a2.75 2.75 0 0 0-.545 2.033c.041.312.15.594.29.88.135.274.32.595.543.98l.025.044c.222.385.408.706.578.96.177.263.367.5.617.69a2.75 2.75 0 0 0 2.033.546c.376-.05.716-.2 1.072-.389a.87.87 0 0 1 .84-.005.86.86 0 0 1 .417.731c.015.402.054.772.2 1.122a2.75 2.75 0 0 0 1.488 1.489c.29.12.59.167.907.188.304.021.675.021 1.12.021h.05c.445 0 .816 0 1.12-.02.318-.022.617-.069.907-.19a2.75 2.75 0 0 0 1.489-1.488c.145-.35.184-.72.2-1.122a.87.87 0 0 1 .415-.732.87.87 0 0 1 .841.006c.356.188.696.339 1.072.388a2.75 2.75 0 0 0 2.033-.544c.25-.192.44-.428.617-.691.17-.254.356-.575.578-.96l.025-.044c.223-.385.408-.706.542-.98.14-.286.25-.569.29-.88a2.75 2.75 0 0 0-.544-2.033c-.231-.301-.532-.52-.872-.734a.87.87 0 0 1-.426-.726c0-.278.152-.554.426-.726.34-.214.64-.433.872-.734a2.75 2.75 0 0 0 .545-2.033 2.8 2.8 0 0 0-.29-.88 18 18 0 0 0-.543-.98l-.025-.044a18 18 0 0 0-.578-.96 2.8 2.8 0 0 0-.617-.69 2.75 2.75 0 0 0-2.033-.546c-.376.05-.716.2-1.072.389a.87.87 0 0 1-.84.005.87.87 0 0 1-.417-.731c-.015-.402-.054-.772-.2-1.122a2.75 2.75 0 0 0-1.488-1.489c-.29-.12-.59-.167-.907-.188-.304-.021-.675-.021-1.12-.021zm-1.453 1.595c.077-.032.194-.061.435-.078.247-.017.567-.017 1.043-.017s.796 0 1.043.017c.241.017.358.046.435.078.307.127.55.37.677.677.04.096.073.247.086.604.03.792.439 1.555 1.165 1.974s1.591.392 2.292.022c.316-.167.463-.214.567-.227a1.25 1.25 0 0 1 .924.247c.066.051.15.138.285.338.139.206.299.483.537.895s.397.69.506.912c.107.217.14.333.15.416a1.25 1.25 0 0 1-.247.924c-.064.083-.178.187-.48.377-.672.422-1.128 1.158-1.128 1.996s.456 1.574 1.128 1.996c.302.19.416.294.48.377.202.263.29.595.247.924-.01.083-.044.2-.15.416-.109.223-.268.5-.506.912s-.399.689-.537.895c-.135.2-.219.287-.285.338a1.25 1.25 0 0 1-.924.247c-.104-.013-.25-.06-.567-.227-.7-.37-1.566-.398-2.292.021s-1.135 1.183-1.165 1.975c-.013.357-.046.508-.086.604a1.25 1.25 0 0 1-.677.677c-.077.032-.194.061-.435.078-.247.017-.567.017-1.043.017s-.796 0-1.043-.017c-.241-.017-.358-.046-.435-.078a1.25 1.25 0 0 1-.677-.677c-.04-.096-.073-.247-.086-.604-.03-.792-.439-1.555-1.165-1.974s-1.591-.392-2.292-.022c-.316.167-.463.214-.567.227a1.25 1.25 0 0 1-.924-.247c-.066-.051-.15-.138-.285-.338a17 17 0 0 1-.537-.895c-.238-.412-.397-.69-.506-.912-.107-.217-.14-.333-.15-.416a1.25 1.25 0 0 1 .247-.924c.064-.083.178-.187.48-.377.672-.422 1.128-1.158 1.128-1.996s-.456-1.574-1.128-1.996c-.302-.19-.416-.294-.48-.377a1.25 1.25 0 0 1-.247-.924c.01-.083.044-.2.15-.416.109-.223.268-.5.506-.912s.399-.689.537-.895c.135-.2.219-.287.285-.338a1.25 1.25 0 0 1 .924-.247c.104.013.25.06.567.227.7.37 1.566.398 2.292-.022.726-.419 1.135-1.182 1.165-1.974.013-.357.046-.508.086-.604.127-.307.37-.55.677-.677" />
            </g>

            <text x="25" y="135" fontSize="14" fill="var(--color-text-muted)">Welcome, here are all of your</text>
            <text x="25" y="155" fontSize="14" fill="var(--color-text-muted)">accounts on the Radix Network</text>

            {/* Card 1: Main Account */}
            <rect x="25" y="190" width="310" height="125" rx="12" fill="url(#w-gt)" />
            <text x="45" y="218" fontSize="14" fontWeight="700" fill="#ffffff">Main Account</text>
            <text x="45" y="238" fontSize="13" fill="rgba(255,255,255,0.85)">acco...23eda1</text>
            <rect x="138" y="227" width="8" height="10" rx="1" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
            <rect x="135" y="224" width="8" height="10" rx="1" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
            <g transform="translate(45, 275)">
              <circle cx="10" cy="15" r="14" fill="#0263e0" />
              <g transform="translate(2.5, 10.2) scale(0.24)">
                <path d="M 0,20 L 12,20 L 24,40 L 46,0 L 62,0" fill="none" stroke="#00d69f" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
              </g>
              <circle cx="30" cy="15" r="14" fill="#f7931a" />
              <text x="30" y="20" fontSize="13" fontWeight="800" fill="#fff" textAnchor="middle">B</text>
              <circle cx="50" cy="15" r="14" fill="#627eea" />
              <polygon points="50,6 54,13 50,18 46,13" fill="#fff" />
              <polygon points="50,20 54,15 50,24 46,15" fill="#fff" />
              <circle cx="70" cy="15" r="14" fill="#141d26" />
              <circle cx="70" cy="15" r="6" fill="#fff" />
              <rect x="90" y="3" width="46" height="24" rx="12" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <circle cx="102" cy="15" r="8" fill="#5033e6" />
              <text x="122" y="19" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">2</text>
              <rect x="142" y="3" width="46" height="24" rx="12" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <circle cx="154" cy="15" r="8" fill="#0263e0" />
              <text x="174" y="19" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">8</text>
            </g>

            {/* Card 2: Savings */}
            <rect x="25" y="330" width="310" height="125" rx="12" fill="url(#w-gp)" />
            <text x="45" y="358" fontSize="14" fontWeight="700" fill="#ffffff">Savings</text>
            <text x="45" y="378" fontSize="13" fill="rgba(255,255,255,0.85)">acco...e32aq5</text>
            <rect x="138" y="367" width="8" height="10" rx="1" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
            <rect x="135" y="364" width="8" height="10" rx="1" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
            <g transform="translate(45, 415)">
              <circle cx="10" cy="15" r="14" fill="#0263e0" stroke="url(#w-gp)" strokeWidth="1.5" />

              {/* Radix Logo verde dentro del círculo Savings */}
              <g transform="translate(2.5, 10.2) scale(0.24)">
                <path d="M 0,20 L 12,20 L 24,40 L 46,0 L 62,0" fill="none" stroke="#00d69f" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
              </g>

              <circle cx="34" cy="15" r="14" fill="#00d69f" stroke="url(#w-gp)" strokeWidth="1.5" />
              <text x="34" y="20" fontSize="13" fontWeight="800" fill="#fff" textAnchor="middle">$</text>
            </g>

            {/* Card 3: My NFTs */}
            <rect x="25" y="470" width="310" height="125" rx="12" fill="url(#w-gb)" />
            <text x="45" y="498" fontSize="14" fontWeight="700" fill="#ffffff">{"My NFT's"}</text>
            <text x="45" y="518" fontSize="13" fill="rgba(255,255,255,0.85)">acco...77r4t2</text>
            <rect x="134" y="507" width="8" height="10" rx="1" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
            <rect x="131" y="504" width="8" height="10" rx="1" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
            <g transform="translate(45, 555)">
              <rect x="0" y="3" width="50" height="24" rx="12" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <circle cx="12" cy="15" r="8" fill="#4ade80" />
              <text x="32" y="19" fontSize="12" fontWeight="700" fill="#fff" textAnchor="middle">12</text>
            </g>

            <rect x="65" y="625" width="230" height="42" rx="8" fill="var(--color-surface)" stroke="var(--color-card-border)" strokeWidth="1" />
            <text x="180" y="651" fontSize="14" fontWeight="600" fill="var(--color-text-main)" textAnchor="middle">Create a new Account</text>
          </g>
        </g>

        {/* ====== LEFT PHONE — TRANSACTION REVIEW ====== */}
        <g transform="translate(65, 45)">
          <rect width="360" height="740" rx="45" fill="var(--color-bg)" stroke="var(--color-card-border)" strokeWidth="3" filter="url(#w-sh-l)" />
          <g clipPath="url(#w-clip)">
            <use href="#w-sb" />
            <path d="M 28 75 L 42 89 M 42 75 L 28 89" stroke="var(--color-text-main)" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="296" y="65" width="36" height="36" rx="8" fill="var(--color-surface)" stroke="var(--color-card-border)" strokeWidth="1" />
            <path d="M 309 77 L 304 83 L 309 89 M 319 77 L 324 83 L 319 89" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <text x="28" y="135" fontSize="28" fontWeight="700" fill="var(--color-text-main)" letterSpacing="-0.5">Review Your</text>
            <text x="28" y="168" fontSize="28" fontWeight="700" fill="var(--color-text-main)" letterSpacing="-0.5">Transaction</text>

            {/* Transaction Background Panel (Replaces old Zig-Zag Ticket) */}
            <rect x="0" y="210" width="360" height="490" fill="var(--color-surface)" filter="url(#w-tkt)" />

            <text x="28" y="248" fontSize="12" fontWeight="700" fill="var(--color-text-muted)" letterSpacing="0.5">WITHDRAWING FROM</text>
            <rect x="28" y="260" width="304" height="100" rx="14" fill="var(--color-surface)" filter="url(#w-crd)" stroke="var(--color-card-border)" strokeWidth="1" />
            <path d="M 28 274 A 14 14 0 0 1 42 260 L 318 260 A 14 14 0 0 1 332 274 L 332 298 L 28 298 Z" fill="url(#w-gt)" />
            <path d="M 28 298 L 332 298 L 332 346 A 14 14 0 0 1 318 360 L 42 360 A 14 14 0 0 1 28 346 Z" fill="var(--color-surface)" stroke="var(--color-card-border)" strokeWidth="1" />
            <text x="42" y="284" fontSize="14" fontWeight="700" fill="#ffffff">My Main Account</text>
            <text x="310" y="284" fontSize="12" fill="rgba(255,255,255,0.85)" textAnchor="end">acco...2qgtxg</text>
            <rect x="315" y="275" width="8" height="10" rx="1" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />

            {/* rUSD Circle with Lighter Blue and Dollar Sign */}
            <circle cx="58" cy="328" r="24" fill="#60a5fa" />
            <text x="58" y="336" fontSize="22" fontWeight="700" fill="#ffffff" textAnchor="middle">$</text>
            <text x="92" y="333" fontSize="14" fontWeight="600" fill="var(--color-text-main)">rUSD</text>
            <text x="318" y="333" fontSize="16" fontWeight="700" fill="var(--color-text-main)" textAnchor="end">20.00</text>

            <line x1="180" y1="365" x2="180" y2="405" stroke="var(--color-card-border)" strokeWidth="3.5" strokeDasharray="4 4" />
            <text x="228" y="393" fontSize="12" fontWeight="600" fill="var(--color-text-muted)" textAnchor="end">Using dApps ^</text>
            <rect x="120" y="405" width="120" height="42" rx="8" fill="var(--color-surface)" filter="url(#w-crd)" stroke="var(--color-card-border)" strokeWidth="1" />
            <rect x="128" y="413" width="26" height="26" rx="6" fill="#001433" />
            <path d="M 141 418 L 141 434 M 133 426 L 149 426 M 135 420 L 147 432 M 135 432 L 147 420" stroke="#00d69f" strokeWidth="2" strokeLinecap="round" fill="none" />
            <text x="162" y="431" fontSize="13" fontWeight="600" fill="var(--color-text-muted)">RadiSwap</text>
            <line x1="180" y1="447" x2="180" y2="480" stroke="var(--color-card-border)" strokeWidth="3.5" strokeDasharray="4 4" />

            <text x="28" y="475" fontSize="12" fontWeight="700" fill="var(--color-text-muted)" letterSpacing="0.5">DEPOSITING TO</text>
            <rect x="28" y="490" width="304" height="150" rx="14" fill="var(--color-surface)" filter="url(#w-crd)" stroke="var(--color-card-border)" strokeWidth="1" />
            <path d="M 28 504 A 14 14 0 0 1 42 490 L 318 490 A 14 14 0 0 1 332 504 L 332 528 L 28 528 Z" fill="url(#w-gp)" />
            <path d="M 28 528 L 332 528 L 332 626 A 14 14 0 0 1 318 640 L 42 640 A 14 14 0 0 1 28 626 Z" fill="var(--color-surface)" stroke="var(--color-card-border)" strokeWidth="1" />
            <text x="42" y="514" fontSize="14" fontWeight="700" fill="#ffffff">My Savings Account</text>
            <text x="310" y="514" fontSize="12" fill="rgba(255,255,255,0.85)" textAnchor="end">acco...39fm48</text>
            <rect x="315" y="505" width="8" height="10" rx="1" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />

            {/* XRD Circle with Radix Logo and Blue Color #0263e0 (Logo ahora es verde #00d69f) */}
            <circle cx="58" cy="565" r="24" fill="#0263e0" />
            <g transform="translate(45.6, 557) scale(0.4)">
              <path d="M 0,20 L 12,20 L 24,40 L 46,0 L 62,0" fill="none" stroke="#00d69f" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
            </g>

            <text x="94" y="570" fontSize="14" fontWeight="600" fill="var(--color-text-main)">XRD</text>
            <text x="318" y="560" fontSize="13" fill="var(--color-text-muted)" textAnchor="end">
              Estimated <tspan fontWeight="700" fill="var(--color-text-main)">32.78688</tspan>
            </text>
            <text x="318" y="578" fontSize="12" fill="var(--color-text-muted)" textAnchor="end">Guaranteed 31.14753</text>
            <text x="180" y="622" fontSize="13" fontWeight="700" fill="var(--color-primary)" textAnchor="middle">Customize Guarantees</text>

            <text x="32" y="720" fontSize="12" fontWeight="700" fill="var(--color-text-muted)" letterSpacing="0.5">TRANSACTION FEE</text>
            <circle cx="162" cy="716" r="6.5" stroke="var(--color-text-muted)" strokeWidth="1.5" fill="none" />
            <text x="162" y="720" fontSize="10" fontWeight="700" fill="var(--color-text-muted)" textAnchor="middle">i</text>
            <text x="330" y="720" fontSize="13" fontWeight="700" fill="var(--color-text-main)" textAnchor="end">XRD 0.1</text>
          </g>
        </g>

      </g>
    </svg>
  );
}

