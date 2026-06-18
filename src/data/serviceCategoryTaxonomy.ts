export type ServiceCategory = 
  | 'Sobrancelhas'
  | 'Cílios'
  | 'Depilação'
  | 'Estética Facial'
  | 'Estética Corporal'
  | 'Massagens e Terapias'
  | 'Unhas'
  | 'Cabelos'
  | 'Maquiagem'
  | 'Micropigmentação'
  | 'Podologia'
  | 'Bem-estar e Bronzeamento'
  | 'Outros';

export interface CategoryDefinition {
  keywords: string[];
  aliases: string[];
  variations: string[];
  services: string[];
}

export interface ServiceCategoryTaxonomy {
  meta: any;
  categories: Record<ServiceCategory, CategoryDefinition>;
  ambiguityRules: any;
  priorityRules: any;
}

export const serviceCategoryTaxonomy: ServiceCategoryTaxonomy = {
  meta: {
    version: "2.0.0",
    platform: "Nera",
    locale: "pt-BR",
    purpose: "Sugestão automática editável de categoria para serviços de profissionais da beleza no Brasil",
    strategy: {
      optimizedCategoryCount: 10,
      mergedCategories: [
        { from: ["Depilação", "Epilação"], to: "Depilação" },
        { from: ["Massagens", "Terapias Corporais"], to: "Massagens e Terapias" },
        { from: ["Tranças", "Cabelos"], to: "Cabelos" },
        { from: ["Bronzeamento", "Bem-estar"], to: "Bem-estar e Bronzeamento" }
      ]
    }
  },
  categories: {
    "Sobrancelhas": {
      keywords: [
        "sobrancelha", "sobrancelhas", "brow", "brows", "brow design", "design de sobrancelha", "design de sobrancelhas", "designer de sobrancelha", "designer de sobrancelhas", "design brow", "brow designer", "modelagem de sobrancelha", "modelagem de sobrancelhas", "arquitetura de sobrancelha", "arquitetura de sobrancelhas", "henna", "henna na sobrancelha", "henna de sobrancelha", "henna de sobrancelhas", "sobrancelha com henna", "brow henna", "tintura de sobrancelha", "tintura de sobrancelhas", "coloração de sobrancelha", "coloração de sobrancelhas", "pigmentação de sobrancelha", "pigmentação de sobrancelhas", "laminação de sobrancelha", "laminação de sobrancelhas", "brow lamination", "browlamination", "laminacao de sobrancelha", "laminacao de sobrancelhas", "lifting de sobrancelha", "lifting de sobrancelhas", "brow lift", "brow lifting", "alinhamento de sobrancelha", "alinhamento de sobrancelhas", "revitalização de sobrancelha", "revitalização de sobrancelhas", "revitalizacao de sobrancelha", "revitalizacao de sobrancelhas", "neutralização de sobrancelha", "neutralização de sobrancelhas", "neutralizacao de sobrancelha", "neutralizacao de sobrancelhas", "spa de sobrancelhas", "limpeza de sobrancelha", "limpeza de sobrancelhas", "higienização de sobrancelha", "higienização de sobrancelhas", "higienizacao de sobrancelha", "higienizacao de sobrancelhas", "fio a fio sobrancelha", "fio a fio de sobrancelha", "fio a fio de sobrancelhas", "correção de sobrancelha", "correção de sobrancelhas", "correcao de sobrancelha", "correcao de sobrancelhas", "sobrancelha masculina", "design masculino de sobrancelha", "brow correction"
      ],
      aliases: [
        "brow", "brows", "sobrancelha", "sobrancelhas", "brow design", "design brow", "designer de sobrancelhas"
      ],
      variations: [
        "designer de sobrancelha", "designer de sobrancelhas", "design sobrancelha", "design de brow", "brow design", "brow designer", "laminacao", "laminação", "revitalizacao", "revitalização", "neutralizacao", "neutralização", "higienizacao", "higienização"
      ],
      services: [
        "Design de sobrancelhas", "Designer de sobrancelhas", "Modelagem de sobrancelhas", "Arquitetura de sobrancelhas", "Henna de sobrancelhas", "Sobrancelha com henna", "Tintura de sobrancelhas", "Coloração de sobrancelhas", "Pigmentação de sobrancelhas", "Brow lamination", "Laminação de sobrancelhas", "Lifting de sobrancelhas", "Brow lift", "Alinhamento de sobrancelhas", "Revitalização de sobrancelhas", "Neutralização de sobrancelhas", "Spa de sobrancelhas", "Limpeza de sobrancelhas", "Higienização de sobrancelhas", "Correção de sobrancelhas", "Fio a fio de sobrancelhas", "Design + henna", "Design masculino de sobrancelhas"
      ]
    },
    "Cílios": {
      keywords: [
        "cilio", "cilios", "cílio", "cílios", "pestana", "pestanas", "lash", "lashes", "lash design", "lash designer", "extensão de cílios", "extensao de cilios", "extensão de cílio", "extensao de cilio", "alongamento de cílios", "alongamento de cilios", "cílios fio a fio", "cilios fio a fio", "fio a fio cílios", "fio a fio cilios", "fio a fio de cílios", "fio a fio de cilios", "volume russo", "mega volume", "volume brasileiro", "volume egípcio", "volume egipcio", "efeito boneca", "efeito fox", "fox eyes", "efeito delineado", "efeito gatinho", "efeito molhado", "wet look lashes", "lash lifting", "lifting de cílios", "lifting de cilios", "lash lift", "lash botox", "botox de cílios", "botox de cilios", "tintura de cílios", "tintura de cilios", "coloração de cílios", "coloração de cilios", "banho de brilho de cílios", "banho de brilho de cilios", "hidratação de cílios", "hidratacao de cilios", "revitalização de cílios", "revitalizacao de cilios", "neutralização de cílios", "neutralizacao de cilios", "remoção de cílios", "remocao de cilios", "remoção de extensão", "manutenção de cílios", "manutencao de cilios", "retorno de cílios", "lash spa", "limpeza de cílios", "limpeza de cilios", "higienização de cílios", "higienizacao de cilios"
      ],
      aliases: [
        "lash", "lashes", "cílios", "cilios", "pestanas", "extensão de cílios", "lash design"
      ],
      variations: [
        "cílio", "cilio", "cílios", "cilios", "extensao", "extensão", "manutencao", "manutenção", "remocao", "remoção", "revitalizacao", "revitalização", "neutralizacao", "neutralização", "higienizacao", "higienização"
      ],
      services: [
        "Extensão de cílios", "Alongamento de cílios", "Extensão de cílios fio a fio", "Cílios fio a fio", "Volume russo", "Mega volume", "Volume brasileiro", "Volume egípcio", "Efeito boneca", "Efeito fox", "Fox eyes", "Efeito delineado", "Efeito gatinho", "Efeito molhado", "Lash lifting", "Lifting de cílios", "Lash botox", "Botox de cílios", "Tintura de cílios", "Coloração de cílios", "Banho de brilho de cílios", "Hidratação de cílios", "Revitalização de cílios", "Neutralização de cílios", "Remoção de extensão de cílios", "Manutenção de cílios", "Retorno de cílios", "Lash spa", "Limpeza de cílios", "Higienização de cílios"
      ]
    },
    "Depilação": {
      keywords: [
        "depilação", "depilacao", "depilar", "depilação feminina", "depilacao feminina", "depilação masculina", "depilacao masculina", "epilação", "epilacao", "epilar", "remoção de pelos", "remocao de pelos", "cera", "cera quente", "cera fria", "cera roll on", "cera roll-on", "depilação com cera", "depilacao com cera", "sugar waxing", "depilação com linha", "depilacao com linha", "linha egípcia", "linha egipcia", "epilação com linha", "epilacao com linha", "fotodepilação", "fotodepilacao", "depilação a laser", "depilacao a laser", "epilação a laser", "epilacao a laser", "laser", "luz pulsada", "ipl", "remoção a laser", "remocao a laser", "definitiva", "depilação definitiva", "depilacao definitiva", "buço", "buco", "axila", "virilha", "meia perna", "perna inteira", "perna completa", "perna", "coxa", "braço", "braco", "antebraço", "antebraco", "abdômen", "abdomen", "costas", "peito", "glúteos", "gluteos", "rosto", "íntima", "intima", "barba", "bigode", "queixo", "nariz", "orelhas", "sobrancelha com linha", "buço com linha", "axila com cera", "virilha completa", "virilha cavada", "virilha simples", "corpo inteiro", "corpo todo", "pelos", "pelo"
      ],
      aliases: [
        "depilação", "depilacao", "epilação", "epilacao", "remoção de pelos", "laser", "cera", "linha egípcia"
      ],
      variations: [
        "depilacao", "depilação", "epilacao", "epilação", "remocao", "remoção", "buco", "buço", "braco", "braço", "abdomen", "abdômen", "gluteos", "glúteos", "egipcia", "egípcia", "intima", "íntima"
      ],
      services: [
        "Depilação com cera", "Depilação com cera quente", "Depilação com cera fria", "Depilação roll-on", "Sugar waxing", "Depilação com linha", "Linha egípcia", "Epilação com linha", "Depilação a laser", "Epilação a laser", "Fotodepilação", "Luz pulsada", "Remoção de pelos a laser", "Depilação de buço", "Depilação de axila", "Depilação de virilha", "Depilação de virilha simples", "Depilação de virilha cavada", "Depilação de virilha completa", "Depilação de meia perna", "Depilação de perna inteira", "Depilação de coxa", "Depilação de braço", "Depilação de antebraço", "Depilação de abdômen", "Depilação de costas", "Depilação de peito", "Depilação de glúteos", "Depilação facial", "Depilação de rosto", "Depilação íntima", "Depilação masculina", "Depilação feminina", "Depilação de barba", "Depilação de bigode", "Depilação de queixo", "Depilação de nariz", "Depilação de orelhas", "Depilação corpo inteiro", "Remoção de pelos"
      ]
    },
    "Estética Facial": {
      keywords: [
        "estética facial", "estetica facial", "facial", "pele", "skin care", "skincare", "limpeza de pele", "limpeza facial", "limpeza de pele profunda", "limpeza profunda", "higienização facial", "higienizacao facial", "extração", "extracao", "extração de comedões", "extracao de comedoes", "cravos", "acne", "tratamento para acne", "hidratação facial", "hidratacao facial", "revitalização facial", "revitalizacao facial", "rejuvenescimento facial", "peeling", "peeling químico", "peeling quimico", "peeling físico", "peeling fisico", "peeling enzimático", "peeling enzimatico", "microagulhamento", "microagulhamento facial", "dermaplaning", "dermaplane", "microdermoabrasão", "microdermoabrasao", "hidradermabrasão", "hidradermabrasao", "bb glow", "radiofrequência facial", "radiofrequencia facial", "ultrassom facial", "ultrassom", "led facial", "fototerapia facial", "máscara facial", "mascara facial", "máscara calmante", "mascara calmante", "máscara hidratante", "mascara hidratante", "manchas", "clareamento facial", "clareamento de manchas", "melasma", "linhas de expressão", "linhas de expressao", "rugas", "poros", "oleosidade", "controle de oleosidade", "detox facial", "esfoliação facial", "esfoliacao facial", "massagem facial", "drenagem facial", "lifting facial", "hidratação glow", "hidratacao glow", "protocolo facial", "tratamento facial", "tratamentos faciais", "revitalização de pele", "revitalizacao de pele", "biossegurança facial", "biosseguranca facial"
      ],
      aliases: [
        "facial", "pele", "skin care", "skincare", "limpeza de pele", "peeling", "dermaplaning"
      ],
      variations: [
        "estetica", "estética", "higienizacao", "higienização", "extracao", "extração", "hidratacao", "hidratação", "revitalizacao", "revitalização", "quimico", "químico", "fisico", "físico", "enzimatico", "enzimático", "radiofrequencia", "radiofrequência", "mascara", "máscara", "oleosidade", "biosseguranca", "biossegurança"
      ],
      services: [
        "Limpeza de pele", "Limpeza de pele profunda", "Limpeza facial", "Higienização facial", "Extração de cravos", "Extração de comedões", "Tratamento para acne", "Hidratação facial", "Revitalização facial", "Rejuvenescimento facial", "Peeling", "Peeling químico", "Peeling físico", "Peeling enzimático", "Microagulhamento facial", "Dermaplaning", "Microdermoabrasão", "Hidradermabrasão", "BB Glow", "Radiofrequência facial", "Ultrassom facial", "LED facial", "Fototerapia facial", "Máscara facial", "Máscara calmante", "Máscara hidratante", "Clareamento facial", "Tratamento para manchas", "Tratamento para melasma", "Tratamento para linhas de expressão", "Tratamento para rugas", "Controle de oleosidade", "Detox facial", "Esfoliação facial", "Massagem facial", "Drenagem facial", "Lifting facial", "Protocolo facial", "Tratamentos faciais", "Revitalização de pele", "Biossegurança facial"
      ]
    },
    "Estética Corporal": {
      keywords: [
        "estética corporal", "estetica corporal", "corporal", "corpo", "tratamento corporal", "tratamentos corporais", "drenagem linfática", "drenagem linfatica", "drenagem pós operatória", "drenagem pos operatoria", "drenagem pós-operatória", "massagem modeladora", "modeladora", "redução de medidas", "reducao de medidas", "gordura localizada", "celulite", "flacidez corporal", "estrias", "criolipólise", "criolipolise", "ultracavitação", "ultracavitacao", "radiofrequência corporal", "radiofrequencia corporal", "corrente russa", "corrente australiana", "vacuoterapia", "endermoterapia", "endermologia", "lipo sem corte", "enzimas", "aplicação de enzimas", "microagulhamento corporal", "esfoliação corporal", "esfoliacao corporal", "peeling corporal", "hidratação corporal", "hidratacao corporal", "clareamento de virilha", "clareamento de axila", "clareamento corporal", "detox corporal", "bandagem", "bandagem crioterápica", "bandagem crioterapica", "manta térmica", "manta termica", "pós operatório estético", "pos operatorio estetico", "pré e pós cirúrgico", "pre e pos cirurgico", "pré e pós-cirúrgico", "tratamento para celulite", "tratamento para flacidez", "tratamento para estrias", "tonificação corporal", "tonificacao corporal", "biossegurança corporal", "biosseguranca corporal"
      ],
      aliases: [
        "corporal", "estética corporal", "drenagem", "modeladora", "criolipólise", "redução de medidas"
      ],
      variations: [
        "estetica", "estética", "linfatica", "linfática", "reducao", "redução", "criolipolise", "criolipólise", "ultracavitacao", "ultracavitação", "radiofrequencia", "radiofrequência", "esfoliacao", "esfoliação", "hidratacao", "hidratação", "pos", "pós", "operatorio", "operatório", "tonificacao", "tonificação", "biosseguranca", "biossegurança"
      ],
      services: [
        "Drenagem linfática", "Drenagem pós-operatória", "Massagem modeladora", "Redução de medidas", "Tratamento para gordura localizada", "Tratamento para celulite", "Tratamento para flacidez", "Tratamento para estrias", "Criolipólise", "Ultracavitação", "Radiofrequência corporal", "Corrente russa", "Corrente australiana", "Vacuoterapia", "Endermoterapia", "Endermologia", "Lipo sem corte", "Aplicação de enzimas", "Microagulhamento corporal", "Esfoliação corporal", "Peeling corporal", "Hidratação corporal", "Clareamento de virilha", "Clareamento de axila", "Clareamento corporal", "Detox corporal", "Bandagem crioterápica", "Manta térmica", "Pré e pós-cirúrgico", "Tonificação corporal", "Tratamentos corporais", "Biossegurança corporal"
      ]
    },
    "Massagens e Terapias": {
      keywords: [
        "massagem", "massagens", "massagem relaxante", "relaxante", "massagem terapêutica", "massagem terapeutica", "massagem modeladora", "quick massage", "shiatsu", "reflexologia", "reflexologia plantar", "pedras quentes", "massagem com pedras quentes", "aromaterapia", "aroma terapia", "ventosaterapia", "ventosa", "ventosas", "bambuterapia", "bambu terapia", "drenagem relaxante", "massagem desportiva", "massagem esportiva", "deep tissue", "liberação miofascial", "liberacao miofascial", "massoterapia", "massoterapeuta", "terapia corporal", "terapias corporais", "terapia integrativa", "estética integrativa", "reiki", "auriculoterapia", "acupuntura estética", "acupuntura estetica", "argiloterapia", "cromoterapia", "moxabustão", "moxabustao", "tui na", "ayurvédica", "ayurvedica", "massagem ayurvédica", "massagem ayurvedica", "terapia holística", "terapia holistica", "florais", "florais de bach", "energia", "energética", "energetica", "relaxamento", "antiestresse", "anti estresse", "bem-estar terapêutico", "bem estar terapeutico"
      ],
      aliases: [
        "massagem", "massoterapia", "ventosaterapia", "terapia corporal", "reiki", "shiatsu"
      ],
      variations: [
        "terapeutica", "terapêutica", "desportiva", "esportiva", "liberacao", "liberação", "estetica", "estética", "ayurvedica", "ayurvédica", "holistica", "holística", "energetica", "energética", "moxabustao", "moxabustão", "bem estar", "bem-estar"
      ],
      services: [
        "Massagem relaxante", "Massagem terapêutica", "Massagem modeladora", "Quick massage", "Shiatsu", "Reflexologia plantar", "Massagem com pedras quentes", "Aromaterapia", "Ventosaterapia", "Bambuterapia", "Massagem desportiva", "Massagem esportiva", "Deep tissue", "Liberação miofascial", "Massoterapia", "Terapia corporal", "Terapias corporais", "Terapia integrativa", "Estética integrativa", "Reiki", "Auriculoterapia", "Acupuntura estética", "Argiloterapia", "Cromoterapia", "Moxabustão", "Tui Na", "Massagem ayurvédica", "Terapia holística", "Florais de Bach", "Relaxamento terapêutico", "Bem-estar terapêutico"
      ]
    },
    "Unhas": {
      keywords: [
        "unha", "unhas", "manicure", "pedicure", "mani", "pedi", "pé e mão", "pe e mao", "esmaltação", "esmaltacao", "esmaltação em gel", "esmaltacao em gel", "blindagem", "blindagem de unhas", "alongamento de unhas", "alongamento em gel", "alongamento em fibra", "fibra de vidro", "acrílico", "acrilico", "porcelana", "gel na tips", "banho de gel", "manutenção de unhas", "manutencao de unhas", "remoção de gel", "remocao de gel", "cutilagem", "cutícula", "cuticula", "spa dos pés", "spa dos pes", "nail art", "decoração de unhas", "decoracao de unhas", "francesinha", "encapsulada", "baby boomer", "stiletto", "almond", "quadrada", "pé na lixa", "pe na lixa", "podolatria estética", "podolatria estetica", "esmalte", "troca de esmalte"
      ],
      aliases: [
        "unhas", "manicure", "pedicure", "nail", "nail art", "esmaltação"
      ],
      variations: [
        "esmaltacao", "esmaltação", "acrilico", "acrílico", "manutencao", "manutenção", "remocao", "remoção", "cuticula", "cutícula", "decoracao", "decoração", "pe", "pé", "pes", "pés", "estetica", "estética"
      ],
      services: [
        "Manicure", "Pedicure", "Manicure e pedicure", "Pé e mão", "Esmaltação tradicional", "Esmaltação em gel", "Blindagem de unhas", "Alongamento de unhas", "Alongamento em gel", "Alongamento em fibra de vidro", "Alongamento em acrílico", "Alongamento em porcelana", "Gel na tips", "Banho de gel", "Manutenção de unhas", "Remoção de gel", "Cutilagem", "Spa dos pés", "Nail art", "Decoração de unhas", "Francesinha", "Unha encapsulada", "Baby boomer", "Stiletto", "Almond", "Unha quadrada", "Pé na lixa", "Podolatria estética", "Troca de esmalte"
      ]
    },
    "Cabelos": {
      keywords: [
        "cabelo", "cabelos", "hair", "capilar", "tratamento capilar", "escova", "escova modelada", "escova lisa", "escova progressiva", "progressiva", "botox capilar", "selagem", "selagem capilar", "hidratação capilar", "hidratacao capilar", "nutrição capilar", "nutricao capilar", "reconstrução capilar", "reconstrucao capilar", "cauterização", "cauterizacao", "cronograma capilar", "lavagem", "lavar cabelo", "escova e prancha", "chapinha", "babyliss", "corte", "corte feminino", "corte masculino", "aparar pontas", "franja", "coloração", "coloracao", "tintura", "retoque de raiz", "raiz", "mechas", "luzes", "morena iluminada", "balayage", "ombre hair", "descoloração", "descoloracao", "matização", "matizacao", "banho de brilho", "banho de brilho capilar", "trança", "tranças", "box braids", "box braid", "nagô", "nago", "twist", "dread", "dreadlock", "penteado", "penteado social", "penteado noiva", "penteado para festa", "coque", "semi preso", "semi-preso", "cachos", "finalização", "finalizacao", "day after", "fitagem", "curvatura", "trança nagô", "tranca nago", "megahair", "mega hair", "alongamento capilar", "aplicação de mega hair", "aplicacao de mega hair"
      ],
      aliases: [
        "cabelos", "cabelo", "hair", "capilar", "progressiva", "penteado", "tranças"
      ],
      variations: [
        "hidratacao", "hidratação", "nutricao", "nutrição", "reconstrucao", "reconstrução", "cauterizacao", "cauterização", "coloracao", "coloração", "descoloracao", "descoloração", "matizacao", "matização", "finalizacao", "finalização", "nago", "nagô", "tranca", "trança", "aplicacao", "aplicação"
      ],
      services: [
        "Escova", "Escova modelada", "Escova lisa", "Escova progressiva", "Progressiva", "Botox capilar", "Selagem capilar", "Hidratação capilar", "Nutrição capilar", "Reconstrução capilar", "Cauterização capilar", "Cronograma capilar", "Lavagem capilar", "Escova e prancha", "Babyliss", "Corte feminino", "Corte masculino", "Aparar pontas", "Franja", "Coloração", "Tintura", "Retoque de raiz", "Mechas", "Luzes", "Morena iluminada", "Balayage", "Ombre hair", "Descoloração", "Matização", "Banho de brilho capilar", "Tranças", "Box braids", "Trança nagô", "Twist", "Dreadlock", "Penteado social", "Penteado para noiva", "Penteado para festa", "Coque", "Semi-preso", "Finalização de cachos", "Day after", "Fitagem", "Mega hair", "Alongamento capilar", "Aplicação de mega hair"
      ]
    },
    "Maquiagem": {
      keywords: [
        "maquiagem", "make", "makeup", "maquiar", "make social", "maquiagem social", "maquiagem profissional", "make profissional", "maquiagem para festa", "maquiagem para noiva", "make noiva", "maquiagem para madrinha", "maquiagem para formatura", "maquiagem para debutante", "maquiagem artística", "maquiagem artistica", "maquiagem glow", "soft glam", "full glam", "make glow", "airbrush", "pele blindada", "maquiagem blindada", "beauty artist", "make beauty", "produção", "producao", "produção completa", "producao completa", "automaquiagem", "auto maquiagem", "curso de maquiagem", "make para ensaio", "maquiagem para ensaio fotográfico", "maquiagem para ensaio fotografico", "maquiagem halloween", "maquiagem infantil"
      ],
      aliases: [
        "maquiagem", "make", "makeup", "make social", "make noiva", "produção"
      ],
      variations: [
        "producao", "produção", "artistica", "artística", "fotografico", "fotográfico", "auto maquiagem", "automaquiagem"
      ],
      services: [
        "Maquiagem social", "Maquiagem profissional", "Maquiagem para festa", "Maquiagem para noiva", "Maquiagem para madrinha", "Maquiagem para formatura", "Maquiagem para debutante", "Maquiagem artística", "Maquiagem glow", "Soft glam", "Full glam", "Airbrush", "Pele blindada", "Maquiagem blindada", "Produção completa", "Automaquiagem", "Curso de maquiagem", "Maquiagem para ensaio fotográfico", "Maquiagem halloween", "Maquiagem infantil"
      ]
    },
    "Micropigmentação": {
      keywords: [
        "micropigmentação", "micropigmentacao", "micropig", "micro", "microblading", "nanopigmentação", "nanopigmentacao", "dermopigmentação", "dermopigmentacao", "pigmentação labial", "pigmentacao labial", "micropigmentação labial", "micropigmentacao labial", "neutralização labial", "neutralizacao labial", "revitalização labial", "revitalizacao labial", "lip blush", "hidra gloss", "hidragloss", "micropigmentação de sobrancelha", "micropigmentação de sobrancelhas", "micropigmentacao de sobrancelha", "micropigmentacao de sobrancelhas", "shadow", "shadow brow", "ombre brows", "sobrancelha shadow", "sobrancelha ombre", "fio a fio micropigmentação", "fio a fio micropigmentacao", "tebori", "delineado permanente", "eyeliner permanente", "pigmentação de olhos", "pigmentacao de olhos", "camuflagem", "camuflagem de estrias", "camuflagem de cicatriz", "paramédica", "paramedica", "micropigmentação paramédica", "micropigmentacao paramedica", "retoque de micropigmentação", "retoque de micropigmentacao", "remoção de micropigmentação", "remocao de micropigmentacao", "despigmentação", "despigmentacao"
      ],
      aliases: [
        "micropigmentação", "micropigmentacao", "micropig", "microblading", "lip blush", "hidragloss"
      ],
      variations: [
        "micropigmentacao", "micropigmentação", "nanopigmentacao", "nanopigmentação", "dermopigmentacao", "dermopigmentação", "neutralizacao", "neutralização", "revitalizacao", "revitalização", "paramedica", "paramédica", "remocao", "remoção", "despigmentacao", "despigmentação"
      ],
      services: [
        "Micropigmentação de sobrancelhas", "Microblading", "Nanopigmentação", "Dermopigmentação", "Sobrancelha shadow", "Sobrancelha ombre", "Fio a fio micropigmentação", "Tebori", "Micropigmentação labial", "Pigmentação labial", "Neutralização labial", "Revitalização labial", "Lip blush", "Hidra gloss", "Hidragloss", "Delineado permanente", "Eyeliner permanente", "Pigmentação de olhos", "Camuflagem de estrias", "Camuflagem de cicatriz", "Micropigmentação paramédica", "Retoque de micropigmentação", "Remoção de micropigmentação", "Despigmentação"
      ]
    },
    "Podologia": {
      keywords: [
        "podologia", "podólogo", "podologo", "podóloga", "podologa", "pé diabético", "pe diabetico", "unha encravada", "onicocriptose", "calo", "calos", "calosidade", "fissura", "rachadura nos pés", "rachadura nos pes", "micose", "onicomicose", "tratamento podológico", "tratamento podologico", "órtese ungueal", "ortese ungueal", "órtese", "ortese", "palmilha", "hidratação dos pés", "hidratacao dos pes", "esfoliação dos pés", "esfoliacao dos pes", "calcanhar", "dedos", "joanete", "podal", "cuidados com os pés", "cuidados com os pes"
      ],
      aliases: [
        "podologia", "podólogo", "podologa", "pé diabético", "unha encravada"
      ],
      variations: [
        "podologo", "podólogo", "podologa", "podóloga", "pe", "pé", "diabetico", "diabético", "podologico", "podológico", "ortese", "órtese", "hidratacao", "hidratação", "esfoliacao", "esfoliação"
      ],
      services: [
        "Podologia", "Tratamento podológico", "Pé diabético", "Tratamento de unha encravada", "Onicocriptose", "Tratamento de calos", "Tratamento de calosidade", "Tratamento de fissura", "Tratamento de rachadura nos pés", "Tratamento de micose", "Onicomicose", "Órtese ungueal", "Palmilha", "Hidratação dos pés", "Esfoliação dos pés", "Cuidados com os pés"
      ]
    },
    "Bem-estar e Bronzeamento": {
      keywords: [
        "bem-estar", "bem estar", "spa", "day spa", "ritual", "ritual spa", "ritual de beleza", "ritual relaxante", "bronzeamento", "bronze", "bronze a jato", "bronzeamento a jato", "autobronzeador", "auto bronzeador", "spray bronze", "spray bronzeador", "bronzeamento natural", "bronzeamento artificial", "banho de lua", "banho dourado", "banho de ervas", "ofurô", "ofuro", "detox spa", "ritual de autocuidado", "relax day", "spa facial e corporal"
      ],
      aliases: [
        "spa", "day spa", "bronzeamento", "bronze", "bronze a jato", "autobronzeador"
      ],
      variations: [
        "bem estar", "bem-estar", "autocuidado", "bronzeador", "ofuro", "ofurô"
      ],
      services: [
        "Day spa", "Ritual spa", "Ritual de beleza", "Ritual relaxante", "Bronzeamento a jato", "Bronzeamento natural", "Bronzeamento artificial", "Auto bronzeador", "Spray bronzeador", "Banho de lua", "Banho dourado", "Banho de ervas", "Ofurô", "Ritual de autocuidado", "Spa facial e corporal"
      ]
    },
    "Outros": {
      keywords: [],
      aliases: ["outros"],
      variations: ["outros"],
      services: []
    }
  },
  ambiguityRules: {
    "fio a fio": {
      type: "contextual",
      resolve: [
        { ifIncludesAny: ["cilio", "cilios", "cílios", "lash", "extensão", "alongamento", "volume"], category: "Cílios" },
        { ifIncludesAny: ["sobrancelha", "sobrancelhas", "brow", "design", "henna"], category: "Sobrancelhas" },
        { ifIncludesAny: ["microblading", "micropigmentação", "micropigmentacao", "tebori", "ombre", "shadow"], category: "Micropigmentação" }
      ],
      fallback: "Outros"
    },
    "design": {
      type: "blocked_without_context",
      resolve: [
        { ifIncludesAny: ["sobrancelha", "sobrancelhas", "brow", "henna", "lamination"], category: "Sobrancelhas" },
        { ifIncludesAny: ["cilio", "cilios", "cílios", "lash"], category: "Cílios" }
      ],
      fallback: "Outros"
    },
    "limpeza": {
      type: "contextual",
      resolve: [
        { ifIncludesAny: ["pele", "facial", "profunda", "extração", "extracao", "cravos", "acne"], category: "Estética Facial" },
        { ifIncludesAny: ["cilio", "cilios", "cílios", "lash"], category: "Cílios" },
        { ifIncludesAny: ["sobrancelha", "sobrancelhas", "brow"], category: "Sobrancelhas" }
      ],
      fallback: "Estética Facial"
    },
    "henna": {
      type: "contextual_default",
      resolve: [
        { ifIncludesAny: ["sobrancelha", "sobrancelhas", "brow", "design"], category: "Sobrancelhas" },
        { ifIncludesAny: ["capilar", "cabelo", "cabelos"], category: "Cabelos" }
      ],
      fallback: "Sobrancelhas"
    },
    "neutralização": {
      type: "contextual",
      resolve: [
        { ifIncludesAny: ["labial", "labio", "lábio", "lip"], category: "Micropigmentação" },
        { ifIncludesAny: ["sobrancelha", "sobrancelhas", "brow"], category: "Sobrancelhas" },
        { ifIncludesAny: ["cilio", "cilios", "cílios", "lash"], category: "Cílios" }
      ],
      fallback: "Outros"
    },
    "revitalização": {
      type: "contextual",
      resolve: [
        { ifIncludesAny: ["labial", "labio", "lábio", "lip", "hidragloss", "hidra gloss"], category: "Micropigmentação" },
        { ifIncludesAny: ["facial", "pele", "rosto"], category: "Estética Facial" },
        { ifIncludesAny: ["sobrancelha", "sobrancelhas", "brow"], category: "Sobrancelhas" },
        { ifIncludesAny: ["cilio", "cilios", "cílios", "lash"], category: "Cílios" }
      ],
      fallback: "Outros"
    },
    "lifting": {
      type: "contextual",
      resolve: [
        { ifIncludesAny: ["lash", "cilio", "cilios", "cílios", "pestana", "pestanas"], category: "Cílios" },
        { ifIncludesAny: ["sobrancelha", "sobrancelhas", "brow"], category: "Sobrancelhas" },
        { ifIncludesAny: ["facial", "rosto", "pele"], category: "Estética Facial" }
      ],
      fallback: "Outros"
    },
    "drenagem": {
      type: "contextual_default",
      resolve: [
        { ifIncludesAny: ["facial", "rosto"], category: "Estética Facial" },
        { ifIncludesAny: ["linfática", "linfatica", "corporal", "pós", "pos", "operatória", "operatoria"], category: "Estética Corporal" }
      ],
      fallback: "Estética Corporal"
    },
    "massagem modeladora": {
      type: "priority_conflict",
      resolve: [
        { ifIncludesAny: ["redução", "reducao", "medidas", "celulite", "gordura", "flacidez", "corporal"], category: "Estética Corporal" }
      ],
      fallback: "Massagens e Terapias"
    },
    "laser": {
      type: "contextual",
      resolve: [
        { ifIncludesAny: ["depilação", "depilacao", "epilação", "epilacao", "pelo", "pelos", "virilha", "axila", "buço", "buco"], category: "Depilação" }
      ],
      fallback: "Depilação"
    },
    "banho de brilho": {
      type: "contextual",
      resolve: [
        { ifIncludesAny: ["capilar", "cabelo", "cabelos"], category: "Cabelos" },
        { ifIncludesAny: ["cilio", "cilios", "cílios", "lash"], category: "Cílios" }
      ],
      fallback: "Cabelos"
    },
    "spa": {
      type: "contextual",
      resolve: [
        { ifIncludesAny: ["sobrancelha", "sobrancelhas", "brow"], category: "Sobrancelhas" },
        { ifIncludesAny: ["cilio", "cilios", "cílios", "lash"], category: "Cílios" },
        { ifIncludesAny: ["day", "ritual", "bronze", "autocuidado", "relax"], category: "Bem-estar e Bronzeamento" }
      ],
      fallback: "Bem-estar e Bronzeamento"
    }
  },
  priorityRules: {
    orderedCategoryEvaluation: [
      "Micropigmentação",
      "Sobrancelhas",
      "Cílios",
      "Estética Facial",
      "Estética Corporal",
      "Depilação",
      "Massagens e Terapias",
      "Unhas",
      "Cabelos",
      "Maquiagem",
      "Podologia",
      "Bem-estar e Bronzeamento",
      "Outros"
    ],
    rules: [
      { name: "exact_service_match", description: "Match exato em services → usar categoria correspondente (prioridade máxima)." },
      { name: "exact_alias_match", description: "Match exato em aliases → usar categoria correspondente." },
      { name: "ambiguity_before_scoring", description: "Se texto contém termo de ambiguityRules, aplicar resolução contextual antes do score." },
      { name: "weighted_keyword_scoring", description: "Score: service exato = 3, alias exato = 2, keyword parcial = 1." },
      { name: "longer_keyword_wins", description: "Keyword mais longa e específica tem prioridade sobre termo curto." },
      { name: "context_window_3_words", description: "Para termos ambíguos, analisar 3 palavras antes e 3 depois no input." },
      { name: "accent_insensitive", description: "Ignorar acentos, caixa, hífen e pluralização simples." },
      { name: "laser_defaults_depilacao", description: "'Laser' sem qualificador → Depilação." },
      { name: "limpeza_defaults_facial", description: "'Limpeza' sozinha → Estética Facial." },
      { name: "design_blocked_alone", description: "'Design' sozinho não classifica. Requer sobrancelha/brow/cílio." },
      { name: "fallback_outros", description: "Score zero ou inconclusivo → categoria Outros." }
    ],
    scoring: {
      exactService: 3,
      exactAlias: 2,
      keywordContains: 1,
      minimumScoreToSuggest: 1,
      tieBreakers: ["categoryOrder", "longerKeyword", "serviceExactness"]
    },
    normalization: {
      lowercase: true,
      removeAccents: true,
      trimExtraSpaces: true,
      replaceHyphenWithSpace: true,
      simpleSingularPluralTolerance: true
    }
  }
};

export function getServiceCategoryNames(): ServiceCategory[] {
  return serviceCategoryTaxonomy.priorityRules.orderedCategoryEvaluation as ServiceCategory[];
}

export function getServiceCategoryDefinition(category: ServiceCategory): CategoryDefinition | undefined {
  return serviceCategoryTaxonomy.categories[category];
}

export function getServiceCategoryKeywords(category: ServiceCategory): string[] {
  const definition = getServiceCategoryDefinition(category);
  return definition ? definition.keywords : [];
}
