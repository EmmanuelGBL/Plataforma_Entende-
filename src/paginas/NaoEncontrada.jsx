import { Botao } from '../componentes/basicos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';

/* Página de endereço inexistente, com o caminho de volta. */
export function NaoEncontrada() {
  usarTituloDaPagina('Página não encontrada');

  return (
    <div className="cartao vazio">
      <h1>Esta página não existe</h1>
      <p>
        O endereço pode ter sido digitado errado, ou a página pode ter mudado de lugar. Nada foi
        perdido: seus materiais continuam guardados.
      </p>
      <div className="linha" style={{ justifyContent: 'center', marginTop: 'var(--e5)' }}>
        <Botao como="link" para="/painel">
          Ir para meus materiais
        </Botao>
        <Botao como="link" para="/ajuda" variante="secundario">
          Abrir a ajuda
        </Botao>
      </div>
    </div>
  );
}
