/** Citação de item normativo no formato de plaqueta de sinalização. É o elemento de assinatura do produto. */
export function Plaqueta({ refText }: { refText: string }) {
  return (
    <span
      className="inline-flex items-center rounded-[3px] border border-grafite bg-sinal px-1.5 py-0.5 font-display text-[0.8125rem] font-semibold leading-none tracking-[0.01em] text-grafite"
      title={`Item citado: ${refText}`}
    >
      {refText}
    </span>
  );
}
