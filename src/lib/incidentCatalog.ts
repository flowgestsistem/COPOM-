import type { IncidentType } from '../types/game';

export type IncidentZone = 'urbano' | 'rural' | 'rodovia' | 'rio';

export interface CatalogEntry {
  title: string;
  type: IncidentType;
  priority: 1 | 2 | 3;
  /** Zonas em que este título faz sentido (obrigatório). */
  zones: IncidentZone[];
  detail: string;
  icon?: string;
}

function entries(
  titles: string[],
  type: IncidentType,
  priority: 1 | 2 | 3,
  zones: IncidentZone[],
  detail: string,
  icon?: string
): CatalogEntry[] {
  return titles.map((title) => ({ title, type, priority, zones: [...zones], detail, icon }));
}

function raisePriority(list: CatalogEntry[], pattern: RegExp, priority: 1 | 2 | 3) {
  for (const e of list) {
    if (pattern.test(e.title)) e.priority = priority;
  }
}

/** Portfólio grande, com títulos coerentes por zona (urbano / rural / rodovia / rio). */
export function buildIncidentCatalog(): CatalogEntry[] {
  const catalog: CatalogEntry[] = [];

  // ═══════════════════════════════════════════
  // POLÍCIA — URBANO
  // ═══════════════════════════════════════════
  const policeUrban = [
    'Roubo em comércio',
    'Assalto a mão armada em padaria',
    'Furto em residência',
    'Arrombamento de loja',
    'Invasão de domicílio',
    'Briga em bar/restaurante',
    'Briga em via pública',
    'Agressão em praça',
    'Ameaça em condomínio',
    'Disparo de arma de fogo em bairro',
    'Pessoa armada em terminal de ônibus',
    'Tráfico de drogas em ponto conhecido',
    'Uso de entorpecentes em praça',
    'Perturbação do sossego em residência',
    'Som alto irregular em festa',
    'Veículo suspeito em estacionamento',
    'Veículo abandonado em via urbana',
    'Placa clonada em blitz urbana',
    'Corrida ilegal em avenida',
    'Direção perigosa no centro',
    'Embriaguez ao volante em via urbana',
    'Acidente sem vítima em cruzamento',
    'Atropelamento em faixa de pedestres',
    'Colisão entre veículos em avenida',
    'Bloqueio de via por manifestação',
    'Tumulto em frente a escola',
    'Vandalismo em patrimônio público',
    'Pichação em prédio comercial',
    'Furto de fios de iluminação pública',
    'Estelionato em andamento no comércio',
    'Golpe do Pix em loja',
    'Sequestro relâmpago em semáforo',
    'Cárcere privado em residência',
    'Pessoa desaparecida no bairro',
    'Menor abandonado em praça',
    'Violência doméstica em residência',
    'Descumprimento de medida protetiva',
    'Pessoa em surto em via pública',
    'Tentativa de suicídio em edifício',
    'Cadáver encontrado em terreno baldio',
    'Objeto suspeito em escola',
    'Denúncia anônima de arma em bar',
    'Roubo de celular em ponto de ônibus',
    'Furto em estacionamento de shopping',
    'Invasão de condomínio',
    'Briga de torcida em estádio/ginásio',
    'Ameaça a comerciante',
    'Assalto a lotérica',
    'Furto em farmácia',
    'Roubo a pedestre no centro',
    'Perturbação em hospital/clínica',
    'Veículo roubado localizado em bairro',
    'Apoio a ronda escolar',
    'Ocorrência em UAI/pronto atendimento',
    'Desordem em fila de banco',
  ];
  catalog.push(
    ...entries(policeUrban, 'policia', 2, ['urbano'], 'Solicitada presença policial na área urbana.')
  );

  // ═══════════════════════════════════════════
  // POLÍCIA — RURAL
  // ═══════════════════════════════════════════
  const policeRural = [
    'Furto de gado em fazenda',
    'Furto de equipamentos agrícolas',
    'Invasão de propriedade rural',
    'Roubo em sede de fazenda',
    'Ameaça entre vizinhos de sítio',
    'Disputa de cerca / limite de terra',
    'Caça ilegal em área rural',
    'Pessoa armada em estrada vicinal',
    'Veículo suspeito em fazenda',
    'Veículo abandonado em estrada de terra',
    'Furto de bomba d’água / irrigação',
    'Furto de insumos agrícolas',
    'Abate irregular de gado',
    'Tráfico de drogas em área rural',
    'Pessoa desaparecida em zona rural',
    'Cadáver encontrado em pasto',
    'Agressão em festa de fazenda',
    'Embriaguez ao volante em estrada rural',
    'Acidente com máquina agrícola',
    'Roubo de motocicleta em sítio',
    'Invasão de curral',
    'Denúncia de trabalho irregular em fazenda',
    'Pessoa sob influência em bar de estrada',
    'Disparo de arma em área rural',
    'Furto de cerca e arame',
    'Roubo de carga em entreposto rural',
    'Ameaça a produtor rural',
    'Violência doméstica em sítio',
    'Menor em situação de risco em zona rural',
    'Apoio a ronda rural',
    'Ocorrência em estrada de chão',
    'Pessoa armada em porteira de fazenda',
    'Furto de energia / gato em sítio',
    'Queimada criminosa em pasto',
    'Animais soltos na estrada vicinal',
  ];
  catalog.push(
    ...entries(policeRural, 'policia', 2, ['rural'], 'Solicitada presença policial em área rural.')
  );

  // ═══════════════════════════════════════════
  // POLÍCIA — RODOVIA
  // ═══════════════════════════════════════════
  const policeRodovia = [
    'Acidente sem vítima em rodovia',
    'Colisão entre veículos na rodovia',
    'Capotamento em trecho de rodovia',
    'Atropelamento em acostamento',
    'Embriaguez ao volante em rodovia',
    'Direção perigosa em rodovia',
    'Corrida ilegal em trecho rodoviário',
    'Veículo abandonado no acostamento',
    'Veículo suspeito em pedágio/trevo',
    'Placa clonada em fiscalização de rodovia',
    'Carga caído na pista',
    'Bloqueio de rodovia',
    'Animal na pista de rodovia',
    'Roubo de carga em rodovia',
    'Assalto a caminhoneiro',
    'Furto de combustível de carreta',
    'Pessoa armada em posto de rodovia',
    'Briga em posto de combustível de estrada',
    'Sequestro relâmpago em trevo',
    'Pessoa desaparecida após parada em rodovia',
    'Denúncia de tráfico em ônibus interestadual',
    'Veículo roubado em fuga pela rodovia',
    'Apoio a blitz rodoviária',
    'Ocorrência em trecho de serra/rodovia',
    'Motorista em surto no acostamento',
  ];
  catalog.push(
    ...entries(policeRodovia, 'policia', 2, ['rodovia'], 'Solicitada presença policial em rodovia.')
  );

  // ═══════════════════════════════════════════
  // POLÍCIA — RIO
  // ═══════════════════════════════════════════
  const policeRio = [
    'Pessoa armada próximo a córrego',
    'Cadáver encontrado às margens do rio',
    'Pessoa desaparecida próximo a rio',
    'Briga em área de pesca',
    'Denúncia de pesca ilegal com arma',
    'Veículo abandonado próximo a córrego',
    'Tráfico de drogas em mata ciliar',
    'Furto de embarcação/canoa',
    'Ameaça em balneário irregular',
    'Ocorrência em ponte sobre rio',
    'Desordem em área de lazer às margens',
    'Roubo a pescador',
  ];
  catalog.push(
    ...entries(policeRio, 'policia', 2, ['rio'], 'Solicitada presença policial próximo a rio/córrego.')
  );

  raisePriority(catalog, /arm|sequestro|disparo|tráfico|cárcere|suicídio|cadáver|roubo de carga/i, 1);
  raisePriority(catalog, /perturbação|som alto|pichação|animal na/i, 3);

  // ═══════════════════════════════════════════
  // BOMBEIROS — URBANO
  // ═══════════════════════════════════════════
  const fireUrban = [
    'Princípio de incêndio em residência',
    'Incêndio estrutural em comércio',
    'Incêndio em veículo na via',
    'Fumaça densa em prédio de apartamentos',
    'Curto-circuito com fumaça em loja',
    'Vazamento de gás em residência',
    'Explosão de botijão em comércio',
    'Pessoa presa em elevador',
    'Pessoa em local confinado (poço de elevador)',
    'Resgate em altura em edifício',
    'Árvore caída sobre via urbana',
    'Poste caído com risco de energia',
    'Fiação partida energizada em poste',
    'Desabamento parcial de muro',
    'Princípio de incêndio em escola',
    'Fumaça em hospital/clínica',
    'Vazamento de produto químico em galpão',
    'Incêndio em estacionamento coberto',
    'Salvamento de pessoa em laje',
    'Animal peçonhento em residência',
    'Resgate de animal em cisterna urbana',
    'Princípio de incêndio em lixeira de condomínio',
    'Fumaça em subsolo de prédio',
    'Acidente com vítima presa em ferragens (via urbana)',
    'Queda de andaime em obra',
    'Incêndio em depósito comercial',
  ];
  catalog.push(
    ...entries(fireUrban, 'incendio', 1, ['urbano'], 'Solicitado Corpo de Bombeiros na área urbana.')
  );

  // ═══════════════════════════════════════════
  // BOMBEIROS — RURAL
  // ═══════════════════════════════════════════
  const fireRural = [
    'Incêndio em vegetação / pasto',
    'Queimada rural descontrolada',
    'Foco de calor em canavial',
    'Incêndio em vegetação de cerrado',
    'Incêndio em sede de fazenda',
    'Incêndio em galpão agrícola',
    'Incêndio em veículo na estrada de terra',
    'Vazamento de agrotóxico em fazenda',
    'Pessoa presa em silo / graneleiro',
    'Resgate em poço / cisterna rural',
    'Queda em poço artesiano',
    'Árvore caída em estrada vicinal',
    'Fiação rural partida com risco',
    'Incêndio em curral / mangueira',
    'Resgate de animal em buraco/cisterna',
    'Princípio de incêndio em casa de sítio',
    'Fumaça em área de preservação rural',
    'Acidente com máquina agrícola e extricação',
    'Capotamento de trator com vítima presa',
    'Queimada ameaçando sede de fazenda',
    'Incêndio em palha / forragem',
    'Desabamento de barracão rural',
  ];
  catalog.push(
    ...entries(fireRural, 'incendio', 1, ['rural'], 'Solicitado Corpo de Bombeiros em área rural.')
  );

  // ═══════════════════════════════════════════
  // BOMBEIROS — RODOVIA
  // ═══════════════════════════════════════════
  const fireRodovia = [
    'Incêndio em veículo na rodovia',
    'Incêndio em carga de carreta',
    'Capotamento com extricação na rodovia',
    'Colisão com risco de incêndio na rodovia',
    'Acidente com vítima presa em ferragens (rodovia)',
    'Vazamento de combustível na pista',
    'Vazamento de produto químico em carreta',
    'Carga perigosa com risco de explosão',
    'Fumaça densa de veículo no acostamento',
    'Resgate em altura em viaduto/rodovia',
    'Árvore caída sobre a pista',
    'Incêndio em posto de combustível de estrada',
    'Extricação de motociclista sob veículo',
  ];
  catalog.push(
    ...entries(fireRodovia, 'incendio', 1, ['rodovia'], 'Solicitado Corpo de Bombeiros em rodovia.')
  );

  // ═══════════════════════════════════════════
  // BOMBEIROS — RIO
  // ═══════════════════════════════════════════
  const fireRio = [
    'Afogamento / risco de afogamento',
    'Resgate em rio',
    'Pessoa arrastada pela correnteza',
    'Embarcação virada no rio',
    'Salvamento de banhista',
    'Criança em risco na beira do córrego',
    'Enchente / alagamento às margens',
    'Veículo caído em córrego',
    'Resgate de animal no rio',
    'Pessoa presa em lamaçal / margem',
    'Busca aquática de desaparecido',
    'Árvore caída bloqueando acesso ao rio',
  ];
  catalog.push(
    ...entries(fireRio, 'incendio', 1, ['rio'], 'Solicitado Corpo de Bombeiros em área de rio/córrego.')
  );

  // ═══════════════════════════════════════════
  // MÉDICA (bombeiros) — URBANO
  // ═══════════════════════════════════════════
  const medUrban = [
    'Mal súbito em via pública',
    'Parada cardiorrespiratória em residência',
    'Dor torácica em comércio',
    'AVC suspeito em residência',
    'Convulsão em escola',
    'Crise hipertensiva em casa',
    'Hipoglicemia em via pública',
    'Queda com trauma em calçada',
    'Fratura exposta em obra urbana',
    'Hemorragia em residência',
    'Queimadura em cozinha residencial',
    'Intoxicação em domicílio',
    'Overdose suspeita em praça',
    'Trabalho de parto em residência',
    'Emergência obstétrica em via',
    'Criança engasgada em residência',
    'Idoso caído sem responder em casa',
    'Acidente de trânsito com vítima em avenida',
    'Atropelamento com vítima no centro',
    'Motociclista caído em cruzamento',
    'Ciclista atropelado em ciclovia',
    'Vítima de agressão em bar',
    'Ferimento por arma branca em via pública',
    'Ferimento por arma de fogo em bairro',
    'Choque elétrico em residência',
    'Picada de animal peçonhento em quintal',
    'Reação alérgica grave em restaurante',
    'Crise asmática em escola',
    'Desmaio em ponto de ônibus',
    'Mal súbito em ginásio/quadra',
    'Queda de idoso em condomínio',
    'Trauma em partida esportiva',
  ];
  catalog.push(
    ...entries(
      medUrban,
      'samu',
      1,
      ['urbano'],
      'Emergência médica — despacho de bombeiros na área urbana.',
      undefined
    )
  );

  // ═══════════════════════════════════════════
  // MÉDICA — RURAL
  // ═══════════════════════════════════════════
  const medRural = [
    'Mal súbito em fazenda',
    'Acidente com máquina agrícola e vítima',
    'Queda de cavalo com trauma',
    'Picada de animal peçonhento em sítio',
    'Trauma por animal de grande porte',
    'Idoso caído em sede de fazenda',
    'Trabalho de parto em área rural',
    'Intoxicação por agrotóxico',
    'Queimadura em atividade rural',
    'Choque elétrico em cerca elétrica / bomba',
    'Convulsão em sítio',
    'Dor torácica em zona rural',
    'AVC suspeito em fazenda',
    'Ferimento grave com ferramenta agrícola',
    'Desmaio em colheita / lavoura',
    'Criança engasgada em sítio',
    'Acidente com motocicleta em estrada de terra',
    'Queda de árvore com vítima em propriedade',
    'Hipoglicemia em trabalhador rural',
    'Emergência obstétrica em zona rural',
  ];
  catalog.push(
    ...entries(
      medRural,
      'samu',
      1,
      ['rural'],
      'Emergência médica — despacho de bombeiros em área rural.'
    )
  );

  // ═══════════════════════════════════════════
  // MÉDICA — RODOVIA
  // ═══════════════════════════════════════════
  const medRodovia = [
    'Acidente de trânsito com vítima na rodovia',
    'Capotamento com múltiplas vítimas',
    'Atropelamento no acostamento',
    'Motociclista caído em rodovia',
    'Colisão frontal com vítimas',
    'Trauma grave em ocupante de carreta',
    'Mal súbito de motorista no acostamento',
    'Parada cardiorrespiratória em ônibus',
    'Passageiro passando mal em ônibus interestadual',
    'Queimadura em acidente com combustível',
    'Extricação com vítima grave na rodovia',
    'Choque após colisão em trevo',
  ];
  catalog.push(
    ...entries(
      medRodovia,
      'samu',
      1,
      ['rodovia'],
      'Emergência médica — despacho de bombeiros em rodovia.',
      'car-crash'
    )
  );

  // ═══════════════════════════════════════════
  // MÉDICA — RIO
  // ═══════════════════════════════════════════
  const medRio = [
    'Afogamento com vítima',
    'Quase-afogamento em balneário',
    'Trauma após salto em rio',
    'Hipotermia / mal-estar após queda na água',
    'Criança resgatada com mal-estar na beira do rio',
    'Picada de animal peçonhento às margens',
    'Mal súbito durante pesca',
    'Vítima de correnteza com trauma',
  ];
  catalog.push(
    ...entries(
      medRio,
      'samu',
      1,
      ['rio'],
      'Emergência médica — despacho de bombeiros em área de rio/córrego.'
    )
  );

  raisePriority(catalog, /parada|AVC|hemorragia|parto|arma|afogamento|capotamento com múltiplas/i, 1);

  // ═══════════════════════════════════════════
  // OCORRÊNCIAS REALISTAS — Uberlândia / MG (2020s)
  // Terminologia de despacho e natureza de crime
  // ═══════════════════════════════════════════
  const policeUdiExtra = [
    'Roubo a residência com moradores no interior',
    'Invasão de residência com arma branca',
    'Furto de motocicleta em estacionamento de faculdade',
    'Assalto a passageiro de app de transporte',
    'Golpe do falso sequestro via ligação',
    'Estelionato do falso boleto em comércio do centro',
    'Pessoa em situação de rua em surto psicótico',
    'Ameaça com arma branca em fila de lotérica',
    'Briga generalizada em festa de bairro',
    'Descumprimento de medida protetiva com perseguição',
    'Violência doméstica com lesão corporal',
    'Importunação sexual em transporte coletivo',
    'Pornografia de vingança / ameaça digital com risco real',
    'Disparo de arma de fogo em via pública (vários tiros)',
    'Abordagem a veículo com placa adulterada',
    'Recuperação de veículo roubado com ocupantes',
    'Tráfico de drogas em ponto de boca de fumo',
    'Usuário em overdose em praça — apoio PM + BM',
    'Racha / corrida ilegal em avenida da cidade',
    'Embriaguez ao volante com recusa de teste',
    'Acidente com fuga do condutor (hit and run)',
    'Atropelamento de pedestre com condutor no local',
    'Bloqueio de via por caminhoneiros / protesto',
    'Invasão de terreno com construção irregular',
    'Furto de energia elétrica (gato) com risco de choque',
    'Ameaça a servidor público no exercício da função',
    'Desordem em UPA / pronto atendimento',
    'Paciente agressivo em unidade de saúde',
    'Menor infrator apreendido em flagrante de furto',
    'Pessoa desaparecida com risco (idoso / criança)',
    'Tentativa de autoextermínio em ponte/viaduto',
    'Denúncia de cárcere privado em imóvel',
    'Cumprimento de mandado de busca e apreensão (apoio)',
    'Escolta de preso entre unidades',
    'Apoio a oficial de justiça em cumprimento de ordem',
    'Ocorrência de maus-tratos a idoso',
    'Maus-tratos a animal com risco de confronto',
    'Porte ilegal de arma branca em via pública',
    'Porte ilegal de arma de fogo (denúncia)',
    'Receptação de mercadoria roubada em comércio',
    'Furto de carga em centro de distribuição',
    'Invasão de propriedade com gado abatido (rural)',
    'Conflito agrário / disputa de posse',
    'Caça ilegal com arma de fogo',
    'Queimada criminosa com risco a residências',
  ];
  catalog.push(
    ...entries(
      policeUdiExtra,
      'policia',
      2,
      ['urbano', 'rural'],
      'Chamado 190 — Polícia Militar de Minas Gerais. Verificar e adotar providências legais.'
    )
  );

  const fireUdiExtra = [
    'Princípio de incêndio em cozinha industrial',
    'Incêndio em subestação / quadro de energia',
    'Fumaça tóxica em galpão de reciclagem',
    'Vazamento de GLP em condomínio',
    'Pessoa presa em veículo após colisão lateral',
    'Extricação de vítima em capotamento urbano',
    'Resgate em altura — trabalhador em andaime',
    'Queda em poço de elevador em obra',
    'Incêndio em vegetação ameaçando condomínio',
    'Desabamento de forro com vítima soterrada parcial',
  ];
  catalog.push(
    ...entries(
      fireUdiExtra,
      'incendio',
      1,
      ['urbano'],
      'Chamado 193 — Corpo de Bombeiros Militar. Socorro e combate a sinistro.'
    )
  );

  const medUdiExtra = [
    'Parada cardiorrespiratória em academia',
    'Suspeita de AVC com janela terapêutica',
    'Trauma craniano após queda de moto',
    'Politraumatizado em acidente de trânsito',
    'Hemorragia digestiva em residência',
    'Crise convulsiva de repetição em via pública',
    'Intoxicação exógena (medicamentos)',
    'Queimadura de 2º grau em acidente doméstico',
    'Parto iminente em veículo particular',
    'Criança com corpo estranho em vias aéreas',
  ];
  catalog.push(
    ...entries(
      medUdiExtra,
      'samu',
      1,
      ['urbano'],
      'Emergência médica — suporte básico de vida pelo Corpo de Bombeiros / APH.'
    )
  );

  raisePriority(
    catalog,
    /autoextermínio|autoexterminio|cárcere|carcere|tiroteio|parada card|politraumatizado|fuga armada|mandado de busca/i,
    1
  );
  raisePriority(catalog, /perturbação|som alto|mau-tratos a animal|gato /i, 3);

  return catalog;
}

let _catalog: CatalogEntry[] | null = null;

export function getIncidentCatalog(): CatalogEntry[] {
  if (!_catalog) _catalog = buildIncidentCatalog();
  return _catalog;
}

export function catalogSize(): number {
  return getIncidentCatalog().length;
}

/** Entradas de um tipo que podem ocorrer na zona. */
export function catalogFor(type: IncidentType, zone: IncidentZone): CatalogEntry[] {
  return getIncidentCatalog().filter((e) => e.type === type && e.zones.includes(zone));
}
