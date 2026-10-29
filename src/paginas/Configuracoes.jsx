import { useNavigate } from 'react-router-dom';
import { ListChecks, LogOut } from 'lucide-react';
import { Botao, Cartao } from '../componentes/basicos.jsx';
import { OpcoesPreferencias } from '../componentes/PainelPreferencias.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp, usarCatalogo } from '../contextos/Aplicacao.jsx';
import { CONJUNTO_REGRAS } from '../dados/conteudo.js';

/* Tela Configurações: os dados da conta (só leitura, porque não há requisito
   para alterá-los), as preferências de exibição (as mesmas do painel
   Acessibilidade da barra superior) e o perfil de adaptação, que é fixo
   nesta versão (RF04). */

export function Configuracoes() {
  usarTituloDaPagina('Configurações');
  const { professor, sair } = usarApp();
  const navegar = useNavigate();
  const catalogo = usarCatalogo();
  const conjunto = catalogo?.conjunto ?? CONJUNTO_REGRAS;

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Configurações</h1>
        <p>Sua conta, a exibição do sistema e o perfil de adaptação.</p>
      </div>

      <div className="grade-configuracoes">
        <Cartao aria-labelledby="titulo-conta">
          <h2 id="titulo-conta">Sua conta</h2>
          <dl className="enviar-fixos enviar-fixos--coluna">
            <div>
              <dt>Nome</dt>
              <dd>{professor?.nome}</dd>
            </div>
            {professor?.email && (
              <div>
                <dt>E-mail</dt>
                <dd>{professor.email}</dd>
              </div>
            )}
          </dl>
          <Botao
            variante="secundario"
            onClick={() => {
              sair();
              navegar('/');
            }}
          >
            <LogOut aria-hidden="true" />
            Sair da conta
          </Botao>
        </Cartao>

        <Cartao aria-labelledby="titulo-adaptacao">
          <h2 id="titulo-adaptacao">Adaptação</h2>
          <dl className="enviar-fixos enviar-fixos--coluna">
            <div>
              <dt>Perfil de adaptação</dt>
              <dd>TEA — Transtorno do Espectro Autista</dd>
            </div>
            <div>
              <dt>Etapa escolar</dt>
              <dd>5º ano do ensino fundamental</dd>
            </div>
            <div>
              <dt>Conjunto de regras em uso</dt>
              <dd>
                {conjunto.identificador} v{conjunto.versao}
              </dd>
            </div>
          </dl>
          <Botao como="link" para="/regras" variante="secundario">
            <ListChecks aria-hidden="true" />
            Ver as regras
          </Botao>
        </Cartao>

        <Cartao aria-labelledby="titulo-exibicao" className="configuracoes-exibicao">
          <h2 id="titulo-exibicao">Exibição</h2>
          <p className="campo__dica">Vale para todas as telas, neste navegador.</p>
          <OpcoesPreferencias />
        </Cartao>
      </div>
    </>
  );
}
