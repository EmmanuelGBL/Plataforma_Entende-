import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, CloudUpload, FileText, Lightbulb, Sparkles } from 'lucide-react';
import { Aviso, Botao, Cartao, Etiqueta } from '../componentes/basicos.jsx';
import { BarraProgresso } from '../componentes/Passos.jsx';
import { usarTituloDaPagina } from '../componentes/Layout.jsx';
import { usarApp, usarCatalogo } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import { ARQUIVOS_DEMO, CONJUNTO_REGRAS } from '../dados/conteudo.js';
import { enviarMaterial, processarAdaptacao, validarArquivo } from '../servicos/api.js';

/* Envio do material (RF02) e adaptação (RF04) num formulário só: escolher o
   arquivo, conferir as informações e enviar. "Enviar material" manda o
   arquivo e já pede a adaptação; se a adaptação falhar, o arquivo enviado é
   reaproveitado na próxima tentativa. O arquivo é validado antes do envio. */

const LIMITE_MB = 15; // RNF08; o servidor confere de novo, inclusive as páginas

const DISCIPLINAS = ['Ciências', 'Geografia', 'História', 'Língua Portuguesa', 'Matemática'];

function tamanhoLegivel(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Validação antes de enviar: formato e tamanho. As páginas só o servidor
 *  conta. */
function problemaDoArquivo(arquivo) {
  if (!arquivo) return null;
  if (!/\.(pdf|docx)$/i.test(arquivo.name)) {
    return {
      titulo: 'Este tipo de arquivo não é aceito',
      motivo: `“${arquivo.name}” não é um PDF nem um documento do Word (.docx).`,
      saida: 'Escolha o material em PDF ou em .docx.',
    };
  }
  if (arquivo.size > LIMITE_MB * 1024 * 1024) {
    return {
      titulo: 'Este material está acima do limite aceito',
      motivo: `O arquivo tem ${tamanhoLegivel(arquivo.size)}. O limite é de ${LIMITE_MB} MB por envio.`,
      saida: 'Separe o material em partes menores — por exemplo, um capítulo por envio — e envie de novo.',
    };
  }
  return null;
}

const COMO_FUNCIONA = [
  ['Envie o seu material', 'Em PDF ou Word (.docx), com até 20 páginas.'],
  [
    'O Entende+ aplica as regras para TEA',
    'O sistema identifica o que cada parágrafo precisa e aplica o conjunto de regras.',
  ],
  ['Você revisa e edita', 'A versão adaptada aparece ao lado do original, com cada mudança explicada.'],
  [
    'Gere o material e a atividade',
    'Depois da sua aprovação, o material sai em PDF e vira uma atividade gamificada.',
  ],
];

const DICAS = [
  'Use textos e atividades do 5º ano.',
  'Prefira arquivos com texto selecionável: PDF só de imagem escaneada não pode ser lido.',
  'Separe apostilas longas em partes de até 20 páginas.',
  'Quanto mais claro o material original, melhor a adaptação.',
];

function Lateral() {
  return (
    <aside className="enviar-lateral" aria-label="Sobre o envio">
      <section className="enviar-lateral__bloco enviar-lateral__bloco--como">
        <h2>Como funciona</h2>
        <ol className="enviar-como">
          {COMO_FUNCIONA.map(([titulo, texto], i) => (
            <li key={titulo}>
              <span className="enviar-como__numero" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <strong>{titulo}</strong>
                <span>{texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="enviar-lateral__bloco enviar-lateral__bloco--dicas">
        <h2>
          <Lightbulb aria-hidden="true" />
          Dicas para um bom resultado
        </h2>
        <ul>
          {DICAS.map((dica) => (
            <li key={dica}>{dica}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export function Enviar() {
  usarTituloDaPagina('Enviar material');
  const navegar = useNavigate();
  const { acrescentarMaterial, modoServidor, enviarArquivo, adaptarMaterial, excluir } = usarApp();
  const catalogo = usarCatalogo();
  const conjuntoVigente = catalogo?.conjunto ?? CONJUNTO_REGRAS;
  const { anunciar } = usarAnuncios();
  const [arquivoReal, setArquivoReal] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [arrastando, setArrastando] = useState(false);

  const [processando, setProcessando] = useState(false);
  const [arquivo, setArquivo] = useState(ARQUIVOS_DEMO[0]);
  const [disciplina, setDisciplina] = useState('Ciências');
  const [problema, setProblema] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [etapaAtual, setEtapaAtual] = useState('');
  const cancelamento = useRef({ cancelado: false });
  const areaProblema = useRef(null);

  const problemaPrevio = modoServidor ? problemaDoArquivo(arquivoReal) : validarArquivo(arquivo);
  const podeEnviar = !problemaPrevio && (!modoServidor || arquivoReal);

  function mostrarProblema(erro) {
    setProblema(erro);
    anunciar(`Erro: ${erro.titulo}`);
  }

  // O foco vai para a mensagem depois que ela aparece: o botão que disparou
  // o envio some durante o processamento.
  useEffect(() => {
    if (!problema) return;
    areaProblema.current?.focus();
    areaProblema.current?.scrollIntoView({ block: 'start' });
  }, [problema]);

  function escolherArquivoReal(novo) {
    setArquivoReal(novo ?? null);
    setEnviado(null);
    setProblema(null);
    if (novo) anunciar(`Arquivo escolhido: ${novo.name}.`);
  }

  async function enviarEAdaptar(evento) {
    evento.preventDefault();
    setProblema(null);
    setProgresso(0);
    setEtapaAtual('Enviando o material e lendo o texto');
    setProcessando(true);
    cancelamento.current = { cancelado: false, controle: new AbortController() };
    anunciar('Enviando e adaptando o material. Isso leva alguns segundos.');

    if (modoServidor) {
      let material = enviado;
      try {
        if (!material) {
          material = await enviarArquivo(arquivoReal);
          setEnviado(material);
        }
        await adaptarMaterial(
          material.id,
          (percentual, etapa) => {
            setProgresso(percentual);
            setEtapaAtual(etapa);
          },
          cancelamento.current,
        );
        anunciar('Adaptação concluída. Abrindo a revisão do material.');
        navegar(`/materiais/${material.id}/adaptacao`);
      } catch (erro) {
        setProcessando(false);
        if (cancelamento.current.cancelado) {
          // Cancelar descarta também o material já enviado.
          if (material) await excluir(material.id).catch(() => {});
          setEnviado(null);
          anunciar('Processamento cancelado. Nenhum material foi salvo.');
          return;
        }
        // Se o envio deu certo e só a adaptação falhou, o material continua
        // enviado e a próxima tentativa pula o envio.
        mostrarProblema(erro);
      }
      return;
    }

    try {
      await enviarMaterial(arquivo);
      await processarAdaptacao((percentual, etapa) => {
        setProgresso(percentual);
        setEtapaAtual(etapa);
      }, cancelamento.current);

      const id = `m-${Math.floor(Math.random() * 900 + 100)}`;
      acrescentarMaterial({
        id,
        nome: arquivo.nome,
        disciplina,
        paginas: arquivo.paginas,
        enviadoEm: new Date().toLocaleDateString('pt-BR'),
        perfil: 'TEA',
        etapa: '5º ano do ensino fundamental',
        estado: 'adaptado',
        versaoRegras: `${CONJUNTO_REGRAS.identificador} v${CONJUNTO_REGRAS.versao}`,
        // Só o arquivo de Ciências tem texto adaptado próprio na demonstração.
        conteudoProprio: arquivo.id === 'ok',
        atividade: { estado: 'rascunho', codigo: null },
      });
      anunciar('Adaptação concluída. Abrindo a revisão do material.');
      navegar(`/materiais/${id}/adaptacao`);
    } catch (erro) {
      setProcessando(false);
      if (cancelamento.current.cancelado) {
        anunciar('Processamento cancelado. Nenhum material foi salvo.');
        return;
      }
      mostrarProblema(erro);
    }
  }

  function cancelar() {
    cancelamento.current.cancelado = true;
    cancelamento.current.controle?.abort();
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Enviar material</h1>
        <p>Envie o material da sua aula para o Entende+ adaptar para estudantes com TEA.</p>
      </div>

      <div className="enviar-grade">
        <div>
          {problema && (
            <div ref={areaProblema} tabIndex={-1}>
              <Aviso tipo="erro" titulo={problema.titulo} papel="alert" nivel={2}>
                <p>{problema.motivo}</p>
                <p>
                  <strong>O que fazer:</strong> {problema.saida}
                </p>
                {problema.regra && (
                  <p className="campo__dica">
                    Regra do sistema: {problema.regra}.
                    {problema.regra === 'RN09' &&
                      ' A recusa é proposital — adaptar um material lido pela metade produziria um resultado errado sem avisar você.'}
                  </p>
                )}
              </Aviso>
            </div>
          )}

          {processando ? (
            <Cartao>
              <h2>Adaptando o material</h2>
              <p>
                Você pode acompanhar o andamento abaixo. Materiais de até 20 páginas levam menos de
                dois minutos.
              </p>
              <BarraProgresso valor={progresso} etapa={etapaAtual} />
              <div className="linha" style={{ marginTop: 'var(--e5)' }}>
                <Botao variante="secundario" onClick={cancelar}>
                  Cancelar o processamento
                </Botao>
              </div>
              <p className="campo__dica" style={{ marginTop: 'var(--e3)' }}>
                Se cancelar, nada é salvo e o arquivo enviado é descartado.
              </p>
            </Cartao>
          ) : (
            <form className="cartao enviar-formulario" onSubmit={enviarEAdaptar} noValidate>
              <section className="enviar-secao" aria-labelledby="secao-arquivo">
                <span className="enviar-secao__numero" aria-hidden="true">
                  1
                </span>
                <div>
                  <h2 id="secao-arquivo">Selecione o arquivo</h2>
                  <p className="enviar-secao__apoio">Você pode enviar arquivos em PDF ou DOCX (Word).</p>

                  {modoServidor ? (
                    <div
                      className={`area-envio${arrastando ? ' area-envio--arrastando' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setArrastando(true);
                      }}
                      onDragLeave={() => setArrastando(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setArrastando(false);
                        escolherArquivoReal(e.dataTransfer.files?.[0]);
                      }}
                    >
                      <CloudUpload aria-hidden="true" className="area-envio__icone" />
                      <p className="area-envio__titulo">Arraste e solte o arquivo aqui</p>
                      <p className="area-envio__apoio">ou</p>
                      <input
                        id="arquivo-material"
                        className="apenas-leitor area-envio__entrada"
                        type="file"
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e) => escolherArquivoReal(e.target.files?.[0])}
                      />
                      <label htmlFor="arquivo-material" className="botao botao--principal">
                        <FileText aria-hidden="true" />
                        Selecionar arquivo
                      </label>
                      {arquivoReal ? (
                        <p className="area-envio__escolhido">
                          <CircleCheck aria-hidden="true" />
                          {arquivoReal.name} · {tamanhoLegivel(arquivoReal.size)}
                        </p>
                      ) : (
                        <p className="area-envio__apoio">
                          Formatos aceitos: PDF ou DOCX · Até 20 páginas e {LIMITE_MB} MB
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Na demonstração, o envio de arquivo aparece desligado, com o motivo. */}
                      <div className="area-envio area-envio--desligada">
                        <CloudUpload aria-hidden="true" className="area-envio__icone" />
                        <p className="area-envio__titulo">Arraste e solte o arquivo aqui</p>
                        <Etiqueta tom="neutra">Indisponível nesta demonstração</Etiqueta>
                        <p className="area-envio__apoio">
                          O protótipo roda inteiro no navegador, sem servidor, e por isso não lê
                          arquivo do seu computador. Escolha um dos materiais de exemplo abaixo.
                        </p>
                      </div>

                      <fieldset>
                        <legend>Arquivos disponíveis nesta demonstração</legend>
                        {ARQUIVOS_DEMO.map((item) => {
                          const marcado = arquivo.id === item.id;
                          return (
                            <label key={item.id} className={`opcao${marcado ? ' opcao--marcada' : ''}`}>
                              <input
                                type="radio"
                                name="arquivo"
                                value={item.id}
                                checked={marcado}
                                onChange={() => {
                                  setArquivo(item);
                                  setProblema(null);
                                }}
                              />
                              <span>
                                <span className="opcao__titulo">{item.nome}</span>
                                <span className="opcao__apoio">
                                  {item.tamanho} · {item.paginas} páginas — {item.descricao}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </fieldset>
                    </>
                  )}

                  {problemaPrevio && (
                    <Aviso tipo="atencao" titulo="Este arquivo não vai ser aceito">
                      <p>{problemaPrevio.motivo}</p>
                      <p>
                        <strong>O que fazer:</strong> {problemaPrevio.saida}
                      </p>
                    </Aviso>
                  )}
                </div>
              </section>

              <section className="enviar-secao" aria-labelledby="secao-informacoes">
                <span className="enviar-secao__numero" aria-hidden="true">
                  2
                </span>
                <div>
                  <h2 id="secao-informacoes">Informações do material</h2>

                  {!modoServidor && (
                    <div className="campo">
                      <label className="campo__rotulo" htmlFor="disciplina">
                        Disciplina
                      </label>
                      <select
                        id="disciplina"
                        className="selecao"
                        value={disciplina}
                        onChange={(e) => setDisciplina(e.target.value)}
                      >
                        {DISCIPLINAS.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <dl className="enviar-fixos">
                    <div>
                      <dt>Perfil de adaptação</dt>
                      <dd>TEA — Transtorno do Espectro Autista</dd>
                    </div>
                    <div>
                      <dt>Etapa escolar</dt>
                      <dd>5º ano do ensino fundamental</dd>
                    </div>
                    <div>
                      <dt>Conjunto de regras</dt>
                      <dd>
                        {conjuntoVigente.identificador} v{conjuntoVigente.versao}
                      </dd>
                    </div>
                  </dl>
                  <p className="campo__dica">
                    Esta versão foi construída e validada para estudantes com TEA do 5º ano. A versão
                    do conjunto de regras fica registrada junto com a adaptação e não muda depois
                    (RN08).
                  </p>
                </div>
              </section>

              <div className="enviar-formulario__acoes">
                <Botao como="link" para="/painel" variante="secundario">
                  Cancelar
                </Botao>
                <Botao type="submit" disabled={!podeEnviar}>
                  <Sparkles aria-hidden="true" />
                  Enviar material
                </Botao>
              </div>
            </form>
          )}
        </div>

        <Lateral />
      </div>
    </>
  );
}
