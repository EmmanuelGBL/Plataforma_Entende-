import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout, LayoutSimples } from './componentes/Layout.jsx';
import { CarregarAtividade } from './componentes/AtividadeAcesso.jsx';
import { usarApp } from './contextos/Aplicacao.jsx';
import { Entrar } from './paginas/Entrar.jsx';
import { Painel } from './paginas/Painel.jsx';
import { Enviar } from './paginas/Enviar.jsx';
import { Adaptacao } from './paginas/Adaptacao.jsx';
import { Atividade } from './paginas/Atividade.jsx';
import { AtividadeEscolha } from './paginas/AtividadeEscolha.jsx';
import { AtividadeJogo } from './paginas/AtividadeJogo.jsx';
import { AtividadeEstudante } from './paginas/AtividadeEstudante.jsx';
import { Impressao } from './paginas/Impressao.jsx';
import { QuestionarioImpresso } from './paginas/QuestionarioImpresso.jsx';
import { Ajuda } from './paginas/Ajuda.jsx';
import { Acessibilidade } from './paginas/Acessibilidade.jsx';
import { NaoEncontrada } from './paginas/NaoEncontrada.jsx';

/* Rotas da aplicação. As três rotas /atividade/:codigo são a mesma atividade
   (mesmas questões) em formas diferentes: escolha, jogo e lista de perguntas. */

/** Rotas do professor exigem sessão. Enquanto a sessão guardada é conferida
 *  no servidor, mostra "Carregando…" em vez de redirecionar. */
function ExigeSessao({ children }) {
  const { autenticado, pronto } = usarApp();
  if (!pronto) {
    return (
      <p role="status" className="campo__dica">
        Carregando…
      </p>
    );
  }
  return autenticado ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Folhas de impressão ficam fora dos layouts: o PDF sai só com o material. */}
      <Route
        path="/materiais/:id/impressao"
        element={
          <ExigeSessao>
            <Impressao />
          </ExigeSessao>
        }
      />

      <Route
        path="/materiais/:id/questionario"
        element={
          <ExigeSessao>
            <QuestionarioImpresso />
          </ExigeSessao>
        }
      />

      {/* Telas sem o menu do professor */}
      <Route element={<LayoutSimples />}>
        <Route path="/" element={<Entrar />} />
        <Route
          path="/atividade/:codigo"
          element={
            <CarregarAtividade>
              <AtividadeEscolha />
            </CarregarAtividade>
          }
        />
        <Route
          path="/atividade/:codigo/jogo"
          element={
            <CarregarAtividade>
              <AtividadeJogo />
            </CarregarAtividade>
          }
        />
        <Route
          path="/atividade/:codigo/perguntas"
          element={
            <CarregarAtividade>
              <AtividadeEstudante />
            </CarregarAtividade>
          }
        />
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
