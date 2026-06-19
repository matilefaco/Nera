export function inferCategory(name: string): string | undefined {
  if (!name || typeof name !== 'string') return undefined;
  
  const s = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (s.includes('bronze') || s.includes('banho de lua') || s.includes('esfoliacao corporal')) return 'Bem-estar e Bronzeamento';
  
  // Massagens
  if (s.includes('massagem') || s.includes('drenagem') || s.includes('relaxante') || s.includes('terapeut') || s.includes('ventosa') || s.includes('pedras quentes') || s.includes('reflexologia')) return 'Massagens e Terapias';
  
  // Cabelos
  if (s.includes('capilar') || s.includes('cabel') || s.includes('corte') || s.includes('coloracao') || s.includes('mechas') || s.includes('progressiva') || s.includes('escova') || s.includes('tranca') || s.includes('luzes') || s.includes('braid') || s.includes('selagem') || s.includes('penteado')) return 'Cabelos';
  
  // Sobrancelhas
  if (s.includes('sobrancelha') || s.includes('brow') || s.includes('design') || s.includes('henna')) {
    return 'Sobrancelhas';
  }
  
  // Micropigmentação (check this before facial/sobrancelha if it's micro)
  if (s.includes('micropigmentacao') || s.includes('micro') || s.includes('shadow') || s.includes('revitalizacao labial') || s.includes('neutralizacao') || s.includes('despigmentacao')) return 'Micropigmentação';
  
  // Depilação
  if (s.includes('depilacao') || s.includes('cera') || s.includes('laser') || s.includes('buco') || s.includes('virilha') || s.includes('axila')) return 'Depilação';
  
  // Maquiagem
  if (s.includes('maquiagem') || s.includes('make') || s.includes('automaquiagem')) return 'Maquiagem';
  
  // Cílios
  if (s.includes('cilio') || s.includes('lash') || s.includes('extensao') || s.includes('volume russo') || s.includes('volume brasileiro') || s.includes('fio a fio')) return 'Cílios';
  
  // Unhas / Nail
  if (s.includes('unha') || s.includes('manicure') || s.includes('pedicure') || s.includes('gel') || s.includes('fibra') || s.includes('esmalta') || s.includes('nail') || s.includes('blindagem') || s.includes('cutilagem') || s.includes('spa dos pes')) return 'Unhas';
  
  // Estética Facial
  if (s.includes('limpeza de pele') || s.includes('peeling') || s.includes('facial') || s.includes('acne') || s.includes('rost') || s.includes('radiofrequencia')) return 'Estética Facial';
  
  // Estética Corporal
  if (s.includes('corporal') || s.includes('estria') || s.includes('celulite') || s.includes('criolipolise') || s.includes('enzima') || s.includes('pos-operatorio')) return 'Estética Corporal';
  
  // Podologia
  if (s.includes('podologia') || s.includes('calo') || s.includes('encravada') || s.includes('podal') || s.includes('plano plant')) return 'Podologia';

  return undefined;
}
