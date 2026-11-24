import fora from '../sons/fora.mp3?inline';
import gol from '../sons/gol.mp3?inline';

/* Sons do jogo. No futebol, gravações de chute e torcida (src/sons/LEIA-ME.md).
   No espaço, notas calculadas aqui, que viram um WAV tocado por <audio>. Não usa Web Audio: num teste em Android os tons curtos
   gerados na hora não saíram. O silêncio do começo dá tempo de o
   alto-falante ligar; as notas ficam acima de 390 Hz, porque o do celular quase
   não reproduz as graves. */

const AMOSTRAS = 22050;
const SILENCIO = 0.15;
const PASSO = 0.16;
const DURACAO = 0.45;
const VOLUME = 0.5;

const NOTAS = { acerto: [523.25, 783.99], erro: [392.0] };
const GRAVACOES = { futebol: { acerto: gol, erro: fora } };

/** WAV mono de 16 bits, com entrada e saída suaves em cada nota. */
function montarWav(notas) {
  const total = Math.ceil((SILENCIO + PASSO * (notas.length - 1) + DURACAO + 0.1) * AMOSTRAS);
  const onda = new Float32Array(total);
  notas.forEach((frequencia, posicao) => {
    const inicio = Math.floor((SILENCIO + PASSO * posicao) * AMOSTRAS);
    for (let i = 0; i < DURACAO * AMOSTRAS; i += 1) {
      const t = i / AMOSTRAS;
      const envelope = Math.min(1, t / 0.02) * (1 - t / DURACAO) ** 2;
      const fase = 2 * Math.PI * frequencia * t;
      onda[inicio + i] += envelope * (0.8 * Math.sin(fase) + 0.2 * Math.sin(2 * fase));
    }
  });

  const dados = new DataView(new ArrayBuffer(44 + total * 2));
  const texto = (posicao, letras) =>
    [...letras].forEach((letra, i) => dados.setUint8(posicao + i, letra.charCodeAt(0)));
  texto(0, 'RIFF');
  dados.setUint32(4, 36 + total * 2, true);
  texto(8, 'WAVEfmt ');
  dados.setUint32(16, 16, true); // tamanho do bloco "fmt "
  dados.setUint16(20, 1, true); // PCM
  dados.setUint16(22, 1, true); // mono
  dados.setUint32(24, AMOSTRAS, true);
  dados.setUint32(28, AMOSTRAS * 2, true);
  dados.setUint16(32, 2, true);
  dados.setUint16(34, 16, true);
  texto(36, 'data');
  dados.setUint32(40, total * 2, true);
  onda.forEach((v, i) =>
    dados.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v * VOLUME)) * 32767, true),
  );
  return new Blob([dados.buffer], { type: 'audio/wav' });
}

const prontos = {};
let tocando = null;

function preparar(tema, resultado) {
  const chave = `${tema}-${resultado}`;
  if (!prontos[chave]) {
    const gravacao = GRAVACOES[tema]?.[resultado];
    prontos[chave] = new Audio(gravacao ?? URL.createObjectURL(montarWav(NOTAS[resultado])));
  }
  return prontos[chave];
}

export function pararSom() {
  tocando?.pause();
  tocando = null;
}

/** Toca o som do resultado ('acerto' ou 'erro') no tema; `false` se o navegador
 *  não deixou. Chamar dentro do toque. */
export async function tocarSom(tema, resultado) {
  try {
    pararSom();
    tocando = preparar(tema, resultado);
    tocando.currentTime = 0;
    await tocando.play();
    return true;
  } catch (erro) {
    // Interrompido por pararSom() não é bloqueio.
    return erro?.name === 'AbortError';
  }
}
