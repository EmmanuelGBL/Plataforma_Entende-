import { BookOpen, Calculator, FileText, Globe, Landmark, Leaf } from 'lucide-react';

/* Ícone do material pela disciplina, e não pelo formato do arquivo: na
   lista, o que distingue um material do outro é a matéria. O formato (PDF,
   DOCX) continua escrito na linha de dados. Sem disciplina informada (o modo
   servidor não pede), procura a matéria no nome do arquivo. */

const DISCIPLINAS = [
  { chave: 'ciencias', Icone: Leaf, tom: 'verde', nome: 'Ciências' },
  { chave: 'geografia', Icone: Globe, tom: 'azul', nome: 'Geografia' },
  { chave: 'historia', Icone: Landmark, tom: 'ambar', nome: 'História' },
  { chave: 'portugues', Icone: BookOpen, tom: 'roxo', nome: 'Língua Portuguesa' },
  { chave: 'matematica', Icone: Calculator, tom: 'ciano', nome: 'Matemática' },
];

const GENERICA = { chave: 'outra', Icone: FileText, tom: 'neutro' };

function normalizar(texto = '') {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function disciplinaDoMaterial(material) {
  const pista = normalizar(`${material.disciplina ?? ''} ${material.nome ?? ''}`);
  return DISCIPLINAS.find(({ chave }) => pista.includes(chave)) ?? GENERICA;
}

export function IconeDisciplina({ material, className = '' }) {
  const { Icone, tom } = disciplinaDoMaterial(material);
  return (
    <span className={`icone-disciplina icone-disciplina--${tom} ${className}`.trim()} aria-hidden="true">
      <Icone />
    </span>
  );
}
