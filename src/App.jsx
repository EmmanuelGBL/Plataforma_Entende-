import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout, LayoutSimples } from './componentes/Layout.jsx';
import { usarApp } from './contextos/Aplicacao.jsx';
import { Entrar } from './paginas/Entrar.jsx';
import { Painel } from './paginas/Painel.jsx';
import { Enviar } from './paginas/Enviar.jsx';
import { Adaptacao } from './paginas/Adaptacao.jsx';
import { Atividade } from './paginas/Atividade.jsx';
import { AtividadeEstudante } from './paginas/AtividadeEstudante.jsx';
import { Impressao } from './paginas/Impressao.jsx';
import { Ajuda } from './paginas/Ajuda.jsx';
import { Acessibilidade } from './paginas/Acessibilidade.jsx';
import { NaoEncontrada } from './paginas/NaoEncontrada.jsx';

/* =========================================================================
   Rotas do protótipo. Cada uma corresponde a casos de uso do diagrama em
   Diagramas/fonte/01-caso-de-uso.puml — nenhuma tela existe sem requisito
   que a justifique:

   /                        UC01                    RF01
   /painel                  UC19, UC20              RF19, RF20
   /enviar                  UC02, UC03, UC04        RF02–RF04, RN09
   /materiais/:id/adaptacao UC05–UC12               RF05–RF12, RN01, RN02, RN08, RN10
   /materiais/:id/impressao UC11                    RF11, RNF02, RNF05
   /materiais/:id/atividade UC13–UC15, UC18         RF13–RF15, RF18, RN04, RN06
   /atividade/:codigo       UC16, UC17              RF16, RF17, RN05
   /ajuda                   UC10                    RF10
   /acessibilidade          —                       RNF01 (exigência do e-MAG)
   ========================================================================= */

/** RNF12 — material só é acessível ao professor que o enviou. No protótipo
 *  isso se resume a exigir sessão para as telas do professor; o filtro por
 *  identificador do professor é assunto do back-end. */
function ExigeSessao({ children }) {
  const { autenticado } = usarApp();
  return autenticado ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Fora dos dois layouts: a folha de impressão não tem barra, menu nem
          rodapé — o que sai no PDF é só o material (RF11). */}
      <Route
        path="/materiais/:id/impressao"
        element={
          <ExigeSessao>
            <Impressao />
          </ExigeSessao>
        }
      />

      {/* Telas sem o menu do professor */}
      <Route element={<LayoutSimples />}>
        <Route path="/" element={<Entrar />} />
        <Route path="/atividade/:codigo" element={<AtividadeEstudante />} />
      </Route>

      {/* Telas do professor */}
      <Route element={<Layout />}>
        <Route
          path="/painel"
          element={
            <ExigeSessao>
              <Painel />
            </ExigeSessao>
          }
        />
        <Route
          path="/enviar"
          element={
            <ExigeSessao>
              <Enviar />
            </ExigeSessao>
          }
        />
        <Route
          path="/materiais/:id/adaptacao"
          element={
            <ExigeSessao>
              <Adaptacao />
            </ExigeSessao>
          }
        />
        <Route
          path="/materiais/:id/atividade"
          element={
            <ExigeSessao>
              <Atividade />
            </ExigeSessao>
          }
        />
        <Route path="/ajuda" element={<Ajuda />} />
        <Route path="/acessibilidade" element={<Acessibilidade />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  );
}
