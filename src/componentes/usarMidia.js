import { useEffect, useState } from 'react';

/** Acompanha uma media query: `true` enquanto a tela combina com ela. */
export function usarMidia(consulta) {
  const [combina, setCombina] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const midia = window.matchMedia(consulta);
    const aoMudar = () => setCombina(midia.matches);
    aoMudar();
    midia.addEventListener('change', aoMudar);
    return () => midia.removeEventListener('change', aoMudar);
  }, [consulta]);
  return combina;
}
