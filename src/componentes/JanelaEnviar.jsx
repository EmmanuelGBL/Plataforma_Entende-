import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  CircleCheck,
  CircleHelp,
  CloudUpload,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Aviso, Botao } from './basicos.jsx';
import { BarraProgresso } from './Passos.jsx';
import { Janela } from './Dialogo.jsx';
import { usarApp, usarCatalogo } from '../contextos/Aplicacao.jsx';
import { usarAnuncios } from '../contextos/Anuncios.jsx';
import { ARQUIVOS_DEMO, CONJUNTO_REGRAS } from '../dados/conteudo.js';
import { enviarMaterial, processarAdaptacao, validarArquivo } from '../servicos/api.js';

/* Envio do material (RF02) e adaptação (RF04) num formulário só, em janela
   aberta pelo botão "Enviar material" de Meus materiais: escolher o arquivo,
   conferir as informações e enviar. "Enviar material" manda o arquivo e já
   pede a adaptação; se a adaptação falhar, o arquivo enviado é reaproveitado
   na próxima tentativa. O arquivo é validado antes do envio. Fechar a janela
   durante o processamento cancela o envio. */

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

/** "Como funciona" e as dicas, fechados por padrão: quem já conhece o fluxo
 *  vai direto ao arquivo. */
function AjudaEnvio() {
  return (
    <details className="faq enviar-ajuda">
      <summary>
        <span>
          <CircleHelp aria-hidden="true" />
          Ajuda para o envio
        </span>
        <ChevronDown aria-hidden="true" className="faq__seta" />
      </summary>
      <div className="enviar-ajuda__corpo">
        <section aria-labelledby="ajuda-como">
          <h4 id="ajuda-como">Como funciona</h4>
          <ol>
            {COMO_FUNCIONA.map(([titulo, texto]) => (
              <li key={titulo}>
                <strong>{titulo}.</strong> {texto}
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="ajuda-dicas">
          <h4 id="ajuda-dicas">Dicas para um bom resultado</h4>
          <ul>
            {DICAS.map((dica) => (
              <li key={dica}>{dica}</li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}

export function JanelaEnviar({ aoFechar }) {
  const navegar = useNavigate();
  const { acrescentarMaterial, modoServidor, enviarArquivo, adaptarMaterial, excluir } = usarApp();
  const catalogo = usarCatalogo();
  const conjuntoVigente = catalogo?.conjunto ?? CONJUNTO_REGRAS;
  const { anunciar, avisar } = usarAnuncios();
  const [arquivoReal, setArquivoReal] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [arrastando, setArrastando] = useState(false);

  const [processando, setProcessando] = useState(false);
  const [arquivo, setArquivo] = useState(ARQUIVOS_DEMO[0]);
  const [disciplina, setDisciplina] = useState(ARQUIVOS_DEMO[0].disciplina);
  const [problema, setProblema] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [etapaAtual, setEtapaAtual] = useState('');
  const cancelamento = useRef({ cancelado: false });
  const areaProblema = useRef(null);

  const problemaPrevio = modoServidor ? problemaDoArquivo(arquivoReal) : validarArquivo(arquivo);
  const podeEnviar = !problemaPrevio && (!modoServidor || arquivoReal);

  function mostrarProblema(erro) {
    setProblema(erro);
    avisar('erro', erro.titulo, erro.saida);
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
        avisar('boa', 'Material adaptado', 'Revise a versão adaptada antes de aprovar.');
        navegar(`/materiais/${material.id}/adaptacao`);
      } catch (erro) {
        setProcessando(false);
        if (cancelamento.current.cancelado) {
          // Cancelar descarta também o material já enviado.
          if (material) await excluir(material.id).catch(() => {});
          setEnviado(null);
          avisar('erro', 'Envio cancelado', 'Nenhum material foi salvo.');
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
      avisar('boa', 'Material adaptado', 'Revise a versão adaptada antes de aprovar.');
      navegar(`/materiais/${id}/adaptacao`);
    } catch (erro) {
      setProcessando(false);
      if (cancelamento.current.cancelado) {
        avisar('erro', 'Envio cancelado', 'Nenhum material foi salvo.');
        return;
      }
      mostrarProblema(erro);
    }
  }

  function cancelar() {
    cancelamento.current.cancelado = true;
    cancelamento.current.controle?.abort();
  }

  function fechar() {
    if (processando) cancelar();
    aoFechar();
  }

  return (
    <Janela
      aberto
      titulo={processando ? 'Adaptando o material' : 'Enviar material'}
      aoFechar={fechar}
      classe="janela-enviar"
      botaoFechar
    >
      <div>
        <div>
          {problema && (
            <div ref={areaProblema} tabIndex={-1}>
              <Aviso tipo="erro" titulo={problema.titulo} papel="alert">
                <p>{problema.motivo}</p>
                <p>
                  <strong>O que fazer:</strong> {problema.saida}
                </p>
              </Aviso>
            </div>
          )}

          {processando ? (
            <div className="enviar-processando">
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
            </div>
          ) : (
            <form className="enviar-formulario" onSubmit={enviarEAdaptar} noValidate>
              {/* Fixos nesta versão (RF04): valem para todo envio, por isso ficam
                  no topo, e não entre os campos a preencher. */}
              <dl className="enviar-resumo" aria-label="Adaptação aplicada a este envio">
                <div>
                  <dt>Perfil</dt>
                  <dd>TEA — Transtorno do Espectro Autista</dd>
                </div>
                <div>
                  <dt>Etapa</dt>
                  <dd>5º ano do ensino fundamental</dd>
                </div>
                <div>
                  <dt>Regras</dt>
                  <dd>
                    {conjuntoVigente.identificador} v{conjuntoVigente.versao}
                  </dd>
                </div>
              </dl>

              <section className="enviar-secao" aria-labelledby="secao-arquivo">
                <span className="enviar-secao__numero" aria-hidden="true">
                  1
                </span>
                <div>
                  <h3 id="secao-arquivo">Selecione o arquivo</h3>
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
                      {/* Na demonstração não há servidor para ler arquivo: a escolha é entre
                         os materiais de exemplo. */}
                      <fieldset>
                        <legend className="apenas-leitor">Materiais de exemplo</legend>
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
                                  // A disciplina acompanha o arquivo, e o professor ainda pode trocar.
                                  if (item.disciplina) setDisciplina(item.disciplina);
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

              {!modoServidor && (
                <section className="enviar-secao" aria-labelledby="secao-disciplina">
                  <span className="enviar-secao__numero" aria-hidden="true">
                    2
                  </span>
                  <fieldset>
                    <legend>
                      <h3 id="secao-disciplina">Disciplina</h3>
                    </legend>
                    <div className="opcoes-chip">
                      {DISCIPLINAS.map((d) => (
                        <label key={d}>
                          <input
                            type="radio"
                            name="disciplina"
                            value={d}
                            checked={disciplina === d}
                            onChange={() => setDisciplina(d)}
                          />
                          <span>{d}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </section>
              )}

              <AjudaEnvio />

              <div className="enviar-formulario__acoes">
                <Botao variante="secundario" onClick={fechar}>
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
      </div>
    </Janela>
  );
}
