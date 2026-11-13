import type { Locale } from "./site";

export const labsCopy = {
  "en": {
    "title": "Labs | Bruno Florian",
    "description": "Engineering experiments and prototypes, including a factual Rate Limiting Lab.",
    "runwayLabel": "Engineering Labs collection",
    "eyebrow": "Experiments · research · playground",
    "heading": "Ideas<br/>in <strong>progress.</strong>",
    "lede": "A space for experiments, prototypes and technical explorations.",
    "available": "Available",
    "labDescription": "Four rate-limiting strategies, with Redis shared state for Fixed Window.",
    "incoming": "Incoming",
    "reserved": "This folder is reserved for a future experiment.",
    "technologies": "Technologies",
    "explore": "Explore the lab",
    "instruction": "Scroll to explore or drag the collection",
    "sceneLabel": "Binary folder collection. Use left and right arrow keys to select a folder.",
    "previous": "Previous folder",
    "next": "Next folder",
    "pause": "Pause ambient motion",
    "resume": "Resume ambient motion",
    "handoff": "Next section",
    "handoffExplore": "Explore another folder",
    "handoffEnd": "Collection complete",
    "projects": "Projects",
    "interactiveScene": "Interactive binary folder collection. Scroll vertically or use the arrow controls to explore five labs.",
    "interactiveInstruction": "Scroll to explore or use the arrows",
    "credit": "Folder scaffold: <a href=\"https://sketchfab.com/3d-models/icon-folder-a3ada26dc877486db8acf03472aa17f8\" rel=\"noopener noreferrer\" target=\"_blank\">“Icon Folder” by Des’Lee</a>, <a href=\"https://creativecommons.org/licenses/by/4.0/\" rel=\"noopener noreferrer\" target=\"_blank\">CC BY 4.0</a>; adapted into a binary holographic scene.",
    "folderTitle": "Rate limiting",
    "folderDetails": "TypeScript · Redis",
    "futureExperiment": "Future experiment"
  },
  "pt-br": {
    "title": "Laboratórios | Bruno Florian",
    "description": "Experimentos e protótipos de engenharia, incluindo o Rate Limiting Lab.",
    "runwayLabel": "Coleção de laboratórios de engenharia",
    "eyebrow": "Experimentos · pesquisa · exploração",
    "heading": "Ideias<br/>em <strong>progresso.</strong>",
    "lede": "Um espaço para experimentos, protótipos e explorações técnicas.",
    "available": "Disponível",
    "labDescription": "Quatro estratégias de rate limiting, com estado compartilhado via Redis para Fixed Window.",
    "incoming": "Em breve",
    "reserved": "Esta pasta está reservada para um experimento futuro.",
    "technologies": "Tecnologias",
    "explore": "Explorar laboratório",
    "instruction": "Role para explorar ou arraste a coleção",
    "sceneLabel": "Coleção de pastas binárias. Use as setas esquerda e direita para selecionar uma pasta.",
    "previous": "Pasta anterior",
    "next": "Próxima pasta",
    "pause": "Pausar movimento ambiente",
    "resume": "Retomar movimento ambiente",
    "handoff": "Próxima seção",
    "handoffExplore": "Explore outra pasta",
    "handoffEnd": "Fim da coleção",
    "projects": "Projetos",
    "interactiveScene": "Coleção interativa de pastas binárias. Role a página ou use as setas para explorar cinco laboratórios.",
    "interactiveInstruction": "Role para explorar ou use as setas",
    "credit": "Geometria-base da pasta: <a href=\"https://sketchfab.com/3d-models/icon-folder-a3ada26dc877486db8acf03472aa17f8\" rel=\"noopener noreferrer\" target=\"_blank\">“Icon Folder”, de Des’Lee</a>, <a href=\"https://creativecommons.org/licenses/by/4.0/\" rel=\"noopener noreferrer\" target=\"_blank\">CC BY 4.0</a>; adaptada para uma cena holográfica binária.",
    "folderTitle": "Rate limiting",
    "folderDetails": "TypeScript · Redis",
    "futureExperiment": "Experimento futuro"
  }
} as const;
export type LabsCopy = typeof labsCopy[Locale];

export const labs = [
  {
    "id": "rate-limiting",
    "hue": 210,
    "bits": [
      "010010101101001",
      "101010010110101",
      "010111001001010",
      "101001010110010"
    ],
    "href": "https://github.com/engineering-proof-labs/rate-limiting-lab",
    "tags": [
      "TypeScript",
      "Node.js",
      "Redis"
    ]
  },
  {
    "id": "upcoming-02",
    "hue": 203,
    "bits": [
      "101001010110010",
      "010111001001010",
      "101010010110101"
    ]
  },
  {
    "id": "upcoming-03",
    "hue": 218,
    "bits": [
      "010101100101010",
      "101010010110101",
      "010111001001010"
    ]
  },
  {
    "id": "upcoming-04",
    "hue": 207,
    "bits": [
      "010111001001010",
      "101001010110010",
      "101010010110101"
    ]
  },
  {
    "id": "upcoming-05",
    "hue": 225,
    "bits": [
      "101010010110101",
      "010101100101010",
      "010111001001010"
    ]
  }
] as const;
