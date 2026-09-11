/* =========================================================================
   Entende+ — conteúdo de demonstração do protótipo
   ---------------------------------------------------------------------------
   IMPORTANTE PARA A BANCA: nada aqui é gerado em tempo real. O motor de
   adaptação e a chamada ao LLM não fazem parte desta entrega. Os textos,
   as regras, as métricas e as questões abaixo são dados fixos, escritos por
   nós, e servem para demonstrar a INTERFACE e o FLUXO.

   O texto original foi redigido pela dupla no estilo de um material de
   Ciências do 5º ano — denso, com período longo e linguagem figurada. Não é
   material de terceiros: evita questão de direito autoral (RN07) e nos dá
   controle sobre os defeitos que a adaptação precisa corrigir.
   ========================================================================= */

export const CONJUNTO_REGRAS = {
  identificador: 'TEA',
  versao: '1.3',
  publicadoEm: '02/09/2026',
  descricao:
    'Conjunto de regras de adaptação para o perfil TEA, 5º ano do ensino fundamental. ' +
    'Derivado da WCAG 2.2, do documento COGA do W3C e das diretrizes do Desenho ' +
    'Universal para a Aprendizagem (CAST, 2024).',
};

/** As dez regras do conjunto. `base` é a referência normativa exibida ao
 *  professor quando ele pergunta "por que isso mudou?" (RF10). */
export const REGRAS = [
  {
    codigo: 'TEA-01',
    nome: 'Períodos curtos',
    descricao: 'Dividir períodos com mais de 20 palavras em orações independentes.',
    base: 'WCAG 2.2 — SC 3.1.5 Reading Level (AAA)',
    justificativa:
      'Período longo exige manter várias informações na memória de trabalho ao mesmo tempo. ' +
      'Dividir em frases curtas reduz essa carga sem tirar conteúdo do texto.',
    ocorrencias: 7,
  },
  {
    codigo: 'TEA-02',
    nome: 'Uma ideia por bloco',
    descricao: 'Separar em parágrafos distintos ideias que estavam no mesmo bloco.',
    base: 'W3C COGA — Make Each Step Clear; DUA 3.2 (CAST, 2024)',
    justificativa:
      'Blocos com várias ideias dificultam localizar onde uma informação começa e termina.',
    ocorrencias: 5,
  },
  {
    codigo: 'TEA-03',
    nome: 'Linguagem literal',
    descricao:
      'Substituir metáfora, comparação figurada e expressão idiomática por descrição literal.',
    base: 'W3C COGA — Use Literal Language',
    justificativa:
      'A compreensão literal é uma característica frequente no perfil TEA. Chamar a folha de ' +
      '"fábrica" pode ser entendido ao pé da letra e produzir erro de conceito.',
    ocorrencias: 4,
  },
  {
    codigo: 'TEA-04',
    nome: 'Voz ativa e ordem direta',
    descricao: 'Reescrever orações na voz passiva em voz ativa, na ordem sujeito-verbo-objeto.',
    base: 'W3C COGA — Use a Simple Sentence Structure',
    justificativa: 'A ordem direta reduz o esforço de identificar quem faz a ação.',
    ocorrencias: 6,
  },
  {
    codigo: 'TEA-05',
    nome: 'Vocabulário explicado',
    descricao:
      'Explicar entre parênteses, na primeira ocorrência, todo termo fora do vocabulário ' +
      'esperado para o 5º ano.',
    base: 'WCAG 2.2 — SC 3.1.3 Unusual Words (AAA)',
    justificativa:
      'Manter o termo técnico e explicá-lo preserva o conteúdo pedagógico (RN01) sem ' +
      'interromper a leitura para consultar outra fonte.',
    ocorrencias: 3,
  },
  {
    codigo: 'TEA-06',
    nome: 'Conectivos explícitos',
    descricao: 'Tornar explícita a relação de causa, consequência e sequência entre as frases.',
    base: 'W3C COGA — Make the Relationship Between Ideas Clear',
    justificativa:
      'Relação implícita obriga o leitor a inferir. A inferência é justamente o ponto de maior ' +
      'dificuldade descrito na literatura sobre compreensão leitora no autismo.',
    ocorrencias: 4,
  },
  {
    codigo: 'TEA-07',
    nome: 'Subtítulos a cada bloco',
    descricao: 'Inserir subtítulo descritivo antes de cada bloco temático.',
    base: 'WCAG 2.2 — SC 2.4.10 Section Headings (AAA)',
    justificativa:
      'O subtítulo antecipa o assunto do bloco e permite reencontrar a informação depois.',
    ocorrencias: 4,
  },
  {
    codigo: 'TEA-08',
    nome: 'Apresentação visual do texto',
    descricao:
      'Alinhar à esquerda, com entrelinha 1,5, espaço entre parágrafos de 1,5 vez a entrelinha ' +
      'e linha de no máximo 80 caracteres.',
    base: 'WCAG 2.2 — SC 1.4.8 Visual Presentation (AAA)',
    justificativa:
      'Texto justificado cria "rios" de espaço em branco e larguras de palavra irregulares, ' +
      'que atrapalham o rastreamento da linha. É a regra que responde por RNF02.',
    ocorrencias: 1,
  },
  {
    codigo: 'TEA-09',
    nome: 'Antecipação da estrutura',
    descricao: 'Abrir o material com a lista do que será lido, na ordem em que aparece.',
    base: 'DUA 3.1 — Ativar conhecimento prévio (CAST, 2024)',
    justificativa:
      'Saber de antemão o que vem pela frente reduz a ansiedade diante do imprevisto e ajuda ' +
      'a organizar a leitura.',
    ocorrencias: 1,
  },
  {
    codigo: 'TEA-10',
    nome: 'Remoção de ruído visual',
    descricao:
      'Remover elemento decorativo que não carrega informação e concorre com o texto pela atenção.',
    base: 'W3C COGA — Avoid Visual Clutter; DUA 7.3 (CAST, 2024)',
    justificativa:
      'Nenhuma informação é perdida: o que sai é ornamento, não conteúdo (RN01).',
    ocorrencias: 2,
  },
];

/* --- Material de demonstração -------------------------------------------- */

export const TEXTO_ORIGINAL = [
  'Desde os tempos mais remotos, as plantas, que são organismos autotróficos, vêm sendo ' +
    'consideradas verdadeiras fábricas verdes, pois é por meio delas que a energia luminosa ' +
    'proveniente do Sol acaba sendo transformada em energia química, a qual fica armazenada ' +
    'nos alimentos que serão posteriormente aproveitados por todos os demais seres vivos que ' +
    'habitam o nosso planeta.',
  'Esse processo, denominado fotossíntese, ocorre principalmente nas folhas, onde se ' +
    'encontram os cloroplastos, estruturas microscópicas que contêm clorofila, o pigmento ' +
    'responsável pela captação da luz; a água absorvida pelas raízes é conduzida até as ' +
    'folhas pelos vasos condutores, ao mesmo tempo em que o gás carbônico presente no ar ' +
    'penetra pelos estômatos, pequenas aberturas localizadas na superfície das folhas.',
  'Uma vez reunidos esses ingredientes, tem início a etapa em que a glicose é produzida ' +
    'pela planta e o gás oxigênio é liberado para a atmosfera como subproduto, sendo esse ' +
    'oxigênio o mesmo que respiramos, razão pela qual costuma-se dizer que as florestas são ' +
    'o pulmão do mundo, expressão que, embora consagrada, deve ser compreendida com cautela.',
  'Convém ressaltar, por fim, que a fotossíntese não se realiza durante a noite, ainda que ' +
    'a respiração vegetal permaneça ocorrendo ininterruptamente, de modo que o balanço entre ' +
    'os dois processos, ao longo de vinte e quatro horas, é o que determina o crescimento do ' +
    'vegetal e, em última análise, a manutenção da vida na Terra tal como a conhecemos.',
];

/** Cada bloco vira um <h4> + parágrafos. Os trechos com `regra` recebem
 *  marcação visual e o professor consegue perguntar "por que isso mudou?". */
export const TEXTO_ADAPTADO = [
  {
    titulo: 'O que você vai ler',
    regra: 'TEA-09',
    paragrafos: [
      'Neste texto você vai ler sobre quatro assuntos, nesta ordem:',
      '1. O que é a fotossíntese.\n2. Onde ela acontece.\n3. O que a planta usa e o que ela produz.\n4. O que acontece de noite.',
    ],
  },
  {
    titulo: '1. O que é a fotossíntese',
    regra: 'TEA-01',
    paragrafos: [
      'A planta produz o próprio alimento. Esse processo se chama fotossíntese.',
      'A planta usa a luz do Sol para fazer isso. A energia da luz fica guardada dentro do alimento.',
      'Outros seres vivos comem esse alimento. Assim, eles também aproveitam essa energia.',
    ],
  },
  {
    titulo: '2. Onde a fotossíntese acontece',
    regra: 'TEA-05',
    paragrafos: [
      'A fotossíntese acontece principalmente nas folhas.',
      'Dentro das folhas existem os cloroplastos (partes muito pequenas da folha, que só aparecem no microscópio).',
      'Dentro dos cloroplastos existe a clorofila (a substância verde que captura a luz do Sol). É a clorofila que dá a cor verde à folha.',
    ],
  },
  {
    titulo: '3. O que a planta usa e o que ela produz',
    regra: 'TEA-06',
    paragrafos: [
      'A planta precisa de três coisas: luz do Sol, água e gás carbônico.',
      'As raízes absorvem a água do solo. Depois, a água sobe pelo caule até as folhas.',
      'O gás carbônico está no ar. Ele entra pelos estômatos (aberturas muito pequenas na superfície da folha).',
      'Com esses três materiais, a planta produz duas coisas: glicose (o alimento da planta) e gás oxigênio.',
      'A planta libera o gás oxigênio no ar. É esse gás que nós respiramos.',
    ],
  },
  {
    titulo: '4. O que acontece de noite',
    regra: 'TEA-03',
    paragrafos: [
      'De noite não há luz do Sol. Por isso, a fotossíntese para.',
      'Mas a planta continua respirando o tempo todo, de dia e de noite.',
      'A planta cresce porque, ao longo do dia inteiro, ela produz mais alimento do que gasta.',
    ],
  },
];

/* --- Métricas de legibilidade (RF07) --------------------------------------
   RN10 manda exibir a métrica sempre, inclusive quando ela piora. A linha
   de contagem de palavras é justamente a que piora: explicar termo e dividir
   período alonga o texto. Esconder isso seria propaganda, não medição.      */
export const METRICAS = [
  {
    nome: 'Palavras por período',
    original: '38,5',
    adaptado: '9,8',
    situacao: 'melhora',
    leitura: 'Quanto menor, menos informação o leitor precisa segurar por vez.',
  },
  {
    nome: 'Períodos por parágrafo',
    original: '1,0',
    adaptado: '1,4',
    situacao: 'melhora',
    leitura: 'Períodos curtos em parágrafos curtos, em vez de um período longo por parágrafo.',
  },
  {
    nome: 'Palavras fora do vocabulário do 5º ano',
    original: '11,2%',
    adaptado: '3,4%',
    situacao: 'melhora',
    leitura: 'As que restaram são termos do conteúdo, e cada uma vem explicada (TEA-05).',
  },
  {
    nome: 'Total de palavras',
    original: '243',
    adaptado: '287',
    situacao: 'atencao',
    leitura:
      'O texto adaptado ficou 18% mais longo. Explicar termos e dividir períodos alonga o ' +
      'material. É o custo conhecido da adaptação, e ele é mostrado sempre (RN10).',
  },
  {
    nome: 'Nível de leitura estimado',
    original: 'Ensino médio',
    adaptado: 'Anos iniciais do fundamental',
    situacao: 'melhora',
    leitura: 'Meta de RNF03: não exigir leitura acima dos anos iniciais.',
  },
];

/* --- Questões geradas do mesmo material (RF13, RN04) --------------------- */
export const QUESTOES = [
  {
    id: 'q1',
    mecanica: 'Escolha única',
    enunciado: 'Como se chama o processo em que a planta produz o próprio alimento?',
    alternativas: ['Respiração', 'Fotossíntese', 'Digestão', 'Evaporação'],
    correta: 1,
    trecho: 'Bloco 1 — O que é a fotossíntese',
  },
  {
    id: 'q2',
    mecanica: 'Escolha única',
    enunciado: 'Em que parte da planta a fotossíntese acontece principalmente?',
    alternativas: ['Nas raízes', 'No caule', 'Nas folhas', 'Nas flores'],
    correta: 2,
    trecho: 'Bloco 2 — Onde a fotossíntese acontece',
  },
  {
    id: 'q3',
    mecanica: 'Escolha única',
    enunciado: 'Qual substância da folha captura a luz do Sol?',
    alternativas: ['A clorofila', 'A glicose', 'A água', 'O gás oxigênio'],
    correta: 0,
    trecho: 'Bloco 2 — Onde a fotossíntese acontece',
  },
  {
    id: 'q4',
    mecanica: 'Escolha única',
    enunciado: 'De quais três coisas a planta precisa para fazer a fotossíntese?',
    alternativas: [
      'Luz do Sol, água e gás carbônico',
      'Luz do Sol, glicose e gás oxigênio',
      'Água, terra e vento',
      'Gás oxigênio, água e calor',
    ],
    correta: 0,
    trecho: 'Bloco 3 — O que a planta usa e o que ela produz',
  },
  {
    id: 'q5',
    mecanica: 'Escolha única',
    enunciado: 'Por que a fotossíntese para durante a noite?',
    alternativas: [
      'Porque a planta está dormindo',
      'Porque não há luz do Sol',
      'Porque falta água no solo',
      'Porque o ar fica mais frio',
    ],
    correta: 1,
    trecho: 'Bloco 4 — O que acontece de noite',
  },
];

/* --- Materiais do professor (RF19) ---------------------------------------
   `conteudoProprio` marca o único material desta demonstração que tem texto
   adaptado escrito para ele. Os outros dois existem para o histórico ter mais
   de uma linha e para mostrar os estados da atividade (publicada, revogada) —
   abri-los reaproveita o texto de Ciências, e a interface avisa isso em vez
   de deixar parecer erro. Ver `AvisoConteudoDemo`.                          */
export const MATERIAIS_INICIAIS = [
  {
    id: 'm-102',
    nome: 'Ciências — Fotossíntese.pdf',
    disciplina: 'Ciências',
    paginas: 3,
    enviadoEm: '05/09/2026',
    perfil: 'TEA',
    etapa: '5º ano do ensino fundamental',
    estado: 'adaptado',
    versaoRegras: `${CONJUNTO_REGRAS.identificador} v${CONJUNTO_REGRAS.versao}`,
    conteudoProprio: true,
    atividade: { estado: 'rascunho', codigo: null },
  },
  {
    id: 'm-098',
    nome: 'História — Povos indígenas do Amazonas.docx',
    disciplina: 'História',
    paginas: 6,
    enviadoEm: '02/09/2026',
    perfil: 'TEA',
    etapa: '5º ano do ensino fundamental',
    estado: 'aprovado',
    versaoRegras: 'TEA v1.2',
    conteudoProprio: false,
    atividade: { estado: 'publicada', codigo: 'PXK4T9' },
  },
  {
    id: 'm-091',
    nome: 'Português — Leitura de fábulas.pdf',
    disciplina: 'Língua Portuguesa',
    paginas: 4,
    enviadoEm: '28/08/2026',
    perfil: 'TEA',
    etapa: '5º ano do ensino fundamental',
    estado: 'aprovado',
    versaoRegras: 'TEA v1.2',
    conteudoProprio: false,
    atividade: { estado: 'revogada', codigo: 'B7M2LQ' },
  },
];

/* --- Arquivos oferecidos na demonstração do envio ------------------------ */
export const ARQUIVOS_DEMO = [
  {
    id: 'ok',
    nome: 'Ciencias-5ano-Fotossintese.pdf',
    tamanho: '1,8 MB',
    paginas: 3,
    extraivel: true,
    descricao: 'PDF com texto selecionável. É o caminho principal da demonstração.',
  },
  {
    id: 'docx',
    nome: 'Historia-5ano-Rio-Negro.docx',
    tamanho: '740 KB',
    paginas: 5,
    extraivel: true,
    descricao: 'Arquivo do Word, o formato que o professor costuma ter em mãos (RF02).',
  },
  {
    id: 'imagem',
    nome: 'Aula-digitalizada-scanner.pdf',
    tamanho: '9,2 MB',
    paginas: 4,
    extraivel: false,
    descricao:
      'PDF que é só imagem escaneada, sem texto reconhecido. Demonstra a recusa prevista na RN09.',
  },
  {
    id: 'grande',
    nome: 'Apostila-bimestre-completo.pdf',
    tamanho: '22,4 MB',
    paginas: 46,
    extraivel: true,
    descricao: 'Acima do limite de 20 páginas e 15 MB (RNF08). Demonstra a prevenção de erro.',
  },
];

export const ETAPAS_PROCESSAMENTO = [
  'Lendo o arquivo enviado',
  'Extraindo o texto e a ordem de leitura',
  'Aplicando o conjunto de regras TEA v1.3',
  'Calculando as métricas de legibilidade',
  'Gerando as questões a partir do mesmo material',
];
