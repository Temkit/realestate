/**
 * Luxembourg communes and their nearby communes.
 * Used to expand search queries for small communes.
 * Data: 100 communes (post-2023 mergers), grouped by canton with verified adjacency.
 */

// Commune → nearby communes (direct neighbors + same canton, 4-8 entries)
export const NEARBY_COMMUNES: Record<string, string[]> = {
  // ── Canton de Capellen ──
  "dippach": ["garnich", "mamer", "kaerjeng", "bertrange", "sanem", "reckange-sur-mess"],
  "garnich": ["steinfort", "kaerjeng", "mamer", "dippach", "koerich"],
  "habscht": ["beckerich", "saeul", "helperknapp", "steinfort", "koerich", "kehlen"],
  "kaerjeng": ["petange", "differdange", "sanem", "dippach", "garnich", "steinfort"],
  "kehlen": ["helperknapp", "mersch", "koerich", "steinsel", "kopstal", "mamer", "strassen"],
  "koerich": ["habscht", "steinfort", "kehlen", "mamer", "garnich"],
  "kopstal": ["kehlen", "steinsel", "walferdange", "strassen", "luxembourg"],
  "mamer": ["garnich", "strassen", "bertrange", "dippach", "koerich", "kehlen"],
  "steinfort": ["habscht", "koerich", "garnich", "kaerjeng"],

  // ── Canton de Clervaux ──
  "clervaux": ["weiswampach", "wincrange", "wiltz", "parc hosingen", "kiischpelt"],
  "parc hosingen": ["clervaux", "kiischpelt", "bourscheid", "putscheid"],
  "troisvierges": ["weiswampach", "wincrange", "clervaux"],
  "weiswampach": ["troisvierges", "clervaux", "wincrange"],
  "wincrange": ["troisvierges", "weiswampach", "clervaux", "winseler", "wiltz"],

  // ── Canton de Diekirch ──
  "bettendorf": ["tandel", "diekirch", "reisdorf", "vallee de l'ernz"],
  "bourscheid": ["kiischpelt", "parc hosingen", "putscheid", "tandel", "esch-sur-sure", "ettelbruck", "feulen"],
  "diekirch": ["tandel", "erpeldange-sur-sure", "bettendorf", "ettelbruck", "schieren"],
  "erpeldange-sur-sure": ["bourscheid", "tandel", "ettelbruck", "diekirch", "schieren"],
  "ettelbruck": ["feulen", "mertzig", "erpeldange-sur-sure", "colmar-berg", "schieren", "diekirch"],
  "feulen": ["bourscheid", "esch-sur-sure", "ettelbruck", "mertzig"],
  "mertzig": ["esch-sur-sure", "feulen", "ettelbruck", "vichten", "colmar-berg"],
  "reisdorf": ["tandel", "bettendorf", "beaufort"],
  "schieren": ["ettelbruck", "erpeldange-sur-sure", "colmar-berg", "nommern"],
  "vallee de l'ernz": ["erpeldange-sur-sure", "diekirch", "bettendorf", "beaufort", "waldbillig", "nommern", "larochette"],

  // ── Canton d'Echternach ──
  "beaufort": ["reisdorf", "berdorf", "waldbillig", "echternach"],
  "bech": ["consdorf", "echternach", "rosport-mompach", "junglinster", "manternach"],
  "berdorf": ["beaufort", "echternach", "waldbillig", "consdorf"],
  "consdorf": ["berdorf", "waldbillig", "heffingen", "echternach", "bech"],
  "echternach": ["berdorf", "consdorf", "bech", "rosport-mompach"],
  "rosport-mompach": ["echternach", "bech", "manternach", "mertert"],
  "waldbillig": ["beaufort", "berdorf", "consdorf", "heffingen"],

  // ── Canton d'Esch-sur-Alzette ──
  "bettembourg": ["leudelange", "mondercange", "schifflange", "roeser", "kayl", "dudelange"],
  "differdange": ["petange", "kaerjeng", "sanem", "esch-sur-alzette"],
  "dudelange": ["bettembourg", "kayl", "schifflange", "mondorf-les-bains"],
  "esch-sur-alzette": ["sanem", "mondercange", "rumelange", "schifflange", "kayl", "differdange"],
  "frisange": ["roeser", "weiler-la-tour", "dalheim", "mondorf-les-bains"],
  "kayl": ["schifflange", "bettembourg", "esch-sur-alzette", "dudelange", "rumelange"],
  "leudelange": ["bertrange", "luxembourg", "reckange-sur-mess", "mondercange", "bettembourg", "roeser"],
  "mondercange": ["sanem", "reckange-sur-mess", "leudelange", "bettembourg", "esch-sur-alzette", "schifflange"],
  "petange": ["kaerjeng", "differdange", "sanem", "steinfort"],
  "pétange": ["kaerjeng", "differdange", "sanem", "steinfort"],
  "reckange-sur-mess": ["dippach", "bertrange", "sanem", "leudelange", "mondercange"],
  "roeser": ["leudelange", "luxembourg", "hesperange", "bettembourg", "weiler-la-tour", "frisange"],
  "rumelange": ["esch-sur-alzette", "kayl", "dudelange"],
  "sanem": ["kaerjeng", "dippach", "reckange-sur-mess", "mondercange", "differdange", "esch-sur-alzette"],
  "schifflange": ["mondercange", "esch-sur-alzette", "bettembourg", "kayl", "dudelange"],

  // ── Canton de Grevenmacher ──
  "betzdorf": ["junglinster", "biwer", "niederanven", "grevenmacher", "schuttrange", "flaxweiler"],
  "biwer": ["bech", "junglinster", "manternach", "betzdorf", "grevenmacher"],
  "flaxweiler": ["betzdorf", "grevenmacher", "wormeldange", "schuttrange", "lenningen"],
  "grevenmacher": ["betzdorf", "manternach", "mertert", "flaxweiler", "wormeldange", "biwer"],
  "junglinster": ["heffingen", "fischbach", "lorentzweiler", "biwer", "steinsel", "niederanven", "betzdorf", "bech"],
  "manternach": ["bech", "rosport-mompach", "biwer", "mertert", "grevenmacher"],
  "mertert": ["rosport-mompach", "manternach", "grevenmacher"],
  "wormeldange": ["grevenmacher", "flaxweiler", "lenningen", "stadtbredimus"],

  // ── Canton de Luxembourg ──
  "bertrange": ["mamer", "strassen", "dippach", "luxembourg", "reckange-sur-mess", "leudelange"],
  "contern": ["sandweiler", "schuttrange", "lenningen", "dalheim", "weiler-la-tour", "hesperange"],
  "hesperange": ["luxembourg", "sandweiler", "contern", "weiler-la-tour", "roeser"],
  "luxembourg": ["strassen", "kopstal", "walferdange", "steinsel", "niederanven", "sandweiler", "hesperange", "bertrange"],
  "luxembourg city": ["strassen", "kopstal", "walferdange", "steinsel", "niederanven", "sandweiler", "hesperange", "bertrange"],
  "niederanven": ["junglinster", "steinsel", "betzdorf", "luxembourg", "sandweiler", "schuttrange"],
  "sandweiler": ["niederanven", "luxembourg", "schuttrange", "hesperange", "contern"],
  "schuttrange": ["niederanven", "betzdorf", "flaxweiler", "lenningen", "contern", "sandweiler"],
  "steinsel": ["kehlen", "kopstal", "niederanven", "walferdange", "luxembourg", "lorentzweiler", "junglinster"],
  "strassen": ["kehlen", "kopstal", "mamer", "luxembourg", "bertrange"],
  "walferdange": ["steinsel", "kopstal", "luxembourg", "lorentzweiler"],
  "weiler-la-tour": ["contern", "hesperange", "roeser", "dalheim", "frisange"],

  // ── Canton de Mersch ──
  "bissen": ["vichten", "colmar-berg", "helperknapp", "mersch"],
  "colmar-berg": ["vichten", "mertzig", "ettelbruck", "schieren", "nommern", "bissen", "mersch"],
  "fischbach": ["nommern", "larochette", "heffingen", "mersch", "junglinster", "lintgen", "lorentzweiler"],
  "heffingen": ["waldbillig", "larochette", "consdorf", "bech", "fischbach", "junglinster"],
  "helperknapp": ["useldange", "vichten", "bissen", "kehlen", "mersch", "saeul", "habscht"],
  "larochette": ["nommern", "heffingen", "fischbach", "mersch"],
  "lintgen": ["mersch", "fischbach", "lorentzweiler"],
  "lorentzweiler": ["mersch", "lintgen", "fischbach", "kehlen", "junglinster", "steinsel"],
  "mersch": ["bissen", "colmar-berg", "nommern", "fischbach", "kehlen", "lorentzweiler", "lintgen", "helperknapp"],
  "nommern": ["schieren", "colmar-berg", "mersch", "fischbach", "larochette"],

  // ── Canton de Redange ──
  "beckerich": ["ell", "redange-sur-attert", "useldange", "saeul", "habscht"],
  "ell": ["rambrouch", "redange-sur-attert", "beckerich"],
  "groussbus-wal": ["esch-sur-sure", "preizerdaul", "mertzig", "vichten", "rambrouch"],
  "preizerdaul": ["rambrouch", "groussbus-wal", "vichten", "redange-sur-attert", "useldange"],
  "rambrouch": ["boulaide", "esch-sur-sure", "ell", "redange-sur-attert", "preizerdaul", "groussbus-wal"],
  "redange-sur-attert": ["rambrouch", "preizerdaul", "ell", "useldange", "beckerich"],
  "saeul": ["useldange", "helperknapp", "beckerich", "habscht"],
  "useldange": ["preizerdaul", "vichten", "redange-sur-attert", "helperknapp", "beckerich", "saeul"],
  "vichten": ["preizerdaul", "colmar-berg", "bissen", "useldange", "helperknapp", "mertzig"],

  // ── Canton de Remich ──
  "bous-waldbredimus": ["lenningen", "stadtbredimus", "remich", "contern", "dalheim"],
  "dalheim": ["contern", "weiler-la-tour", "frisange", "mondorf-les-bains", "schengen"],
  "lenningen": ["schuttrange", "flaxweiler", "wormeldange", "bous-waldbredimus", "contern"],
  "mondorf-les-bains": ["dalheim", "schengen", "remich", "frisange", "bettembourg", "dudelange"],
  "remich": ["stadtbredimus", "bous-waldbredimus", "schengen", "mondorf-les-bains", "dalheim"],
  "schengen": ["dalheim", "remich", "mondorf-les-bains"],
  "stadtbredimus": ["lenningen", "wormeldange", "bous-waldbredimus", "remich"],

  // ── Canton de Vianden ──
  "putscheid": ["parc hosingen", "bourscheid", "tandel", "vianden"],
  "tandel": ["putscheid", "vianden", "bourscheid", "erpeldange-sur-sure", "diekirch", "bettendorf"],
  "vianden": ["putscheid", "tandel", "bourscheid"],

  // ── Canton de Wiltz ──
  "boulaide": ["lac de la haute-sure", "esch-sur-sure", "rambrouch"],
  "esch-sur-sure": ["lac de la haute-sure", "goesdorf", "bourscheid", "boulaide", "feulen", "rambrouch", "mertzig"],
  "goesdorf": ["wiltz", "kiischpelt", "lac de la haute-sure", "bourscheid", "esch-sur-sure"],
  "kiischpelt": ["clervaux", "wiltz", "parc hosingen", "goesdorf", "bourscheid"],
  "lac de la haute-sure": ["winseler", "wiltz", "goesdorf", "boulaide", "esch-sur-sure"],
  "wiltz": ["wincrange", "clervaux", "winseler", "kiischpelt", "lac de la haute-sure", "goesdorf"],
  "winseler": ["wincrange", "wiltz", "lac de la haute-sure"],

  // ── Luxembourg City neighborhoods (mapped to city + nearby communes) ──
  "kirchberg": ["luxembourg", "niederanven", "sandweiler", "strassen", "walferdange", "steinsel"],
  "bonnevoie": ["luxembourg", "hesperange", "sandweiler", "roeser", "bertrange"],
  "gasperich": ["luxembourg", "hesperange", "leudelange", "bertrange", "roeser"],
  "belair": ["luxembourg", "strassen", "bertrange", "mamer", "kopstal"],
  "limpertsberg": ["luxembourg", "walferdange", "steinsel", "kopstal", "strassen"],
  "hollerich": ["luxembourg", "bertrange", "strassen", "leudelange"],
  "grund": ["luxembourg", "hesperange", "bonnevoie", "hollerich"],
  "clausen": ["luxembourg", "kirchberg", "niederanven", "sandweiler"],
  "merl": ["luxembourg", "strassen", "bertrange", "hollerich"],
  "cessange": ["luxembourg", "leudelange", "bertrange", "gasperich"],
  "neudorf": ["luxembourg", "kirchberg", "niederanven", "sandweiler"],
  "beggen": ["luxembourg", "walferdange", "steinsel", "limpertsberg"],
  "cents": ["luxembourg", "kirchberg", "niederanven", "sandweiler"],
  "hamm": ["luxembourg", "sandweiler", "hesperange", "cents"],
  "belval": ["sanem", "esch-sur-alzette", "differdange", "mondercange", "bettembourg"],
  "belvaux": ["sanem", "esch-sur-alzette", "differdange", "mondercange"],
};

/**
 * Get nearby communes for a given location (tier 1 = immediate neighbors).
 */
export function getNearbyCommunes(location: string): string[] {
  const normalized = normalizeCommune(location);
  const nearby = NEARBY_COMMUNES[normalized];
  if (!nearby) return [];
  return nearby.slice(0, 5).map(capitalize);
}

/**
 * Get tier 1 neighbors (5-10 min, immediate adjacency).
 */
export function getTier1Communes(location: string): string[] {
  const normalized = normalizeCommune(location);
  const nearby = NEARBY_COMMUNES[normalized];
  if (!nearby) return [];
  return nearby.slice(0, 4).map(capitalize);
}

/**
 * Get tier 2 neighbors (15-20 min, second ring — neighbors of neighbors).
 * Excludes tier 1 and the original commune.
 */
export function getTier2Communes(location: string): string[] {
  const normalized = normalizeCommune(location);
  const tier1 = NEARBY_COMMUNES[normalized];
  if (!tier1) return [];

  const exclude = new Set([normalized, ...tier1]);
  const tier2 = new Set<string>();

  for (const neighbor of tier1) {
    const neighborsOfNeighbor = NEARBY_COMMUNES[neighbor] || [];
    for (const n of neighborsOfNeighbor) {
      if (!exclude.has(n)) tier2.add(n);
    }
  }

  return [...tier2].slice(0, 5).map(capitalize);
}

function normalizeCommune(location: string): string {
  return location.toLowerCase().trim()
    .replace(/,\s*luxemb.*$/i, "")
    .replace(/\s+city$/i, "")
    .trim();
}

function capitalize(s: string): string {
  return s.split(/[-\s]/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join("-").replace(/-Sur-/g, "-sur-").replace(/-Les-/g, "-les-").replace(/-La-/g, "-la-").replace(/-De-/g, "-de-").replace(/-L'/g, "-l'");
}
