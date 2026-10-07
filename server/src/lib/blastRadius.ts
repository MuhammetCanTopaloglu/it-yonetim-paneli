/**
 * Etki Analizi (blast radius) — SAF fonksiyon, DB/HTTP'den tamamen bağımsız
 * (birim testlerle doğrulanabilir, route sadece veriyi toplayıp buraya verir).
 *
 * Tanım: bir switch (targetId) devre dışı kalırsa, omurgaya (backboneIds)
 * BAŞKA hangi switch'ler artık ulaşamaz? Bu, sadece "hedefin komşusu mu"
 * sorusu DEĞİL — kaldırma SONRASI kalan grafta omurgadan gerçekten
 * erişilebilir mi sorusu. Yedekli bağlantılar (bir switch omurgaya iki farklı
 * yoldan bağlıysa) bu yüzden doğru şekilde "etkilenmez" sonucunu verir.
 *
 * "Etkilenen" tanımı kasıtlı olarak ÖNCEKİ/SONRAKİ erişilebilirlik farkı
 * olarak kuruldu (sadece "kaldırınca omurgaya ulaşamayanlar" değil): zaten
 * omurgaya hiç bağlı olmayan (izole) bir switch, hedef ne olursa olsun hep
 * "etkilenen" gibi görünmesin diye — bu yanıltıcı olurdu. Böylece bir
 * switch'in etkisi gerçekten O switch'in varlığına bağımlı olanlarla sınırlı
 * kalıyor.
 */

export interface BlastRadiusInput {
  /** Graftaki tüm switch id'leri (analiz edilen dahil). */
  switchIds: string[];
  /** Yönsüz kenarlar — switch_links + switch_ports (connection_type='switch') birleşimi, port_type'tan bağımsız. */
  edges: [string, string][];
  /** Omurga olarak işaretli switch id'leri (birden fazla olabilir — çoklu-kaynak BFS). */
  backboneIds: string[];
  /** Analiz edilen switch. */
  targetId: string;
}

export interface BlastRadiusResult {
  targetId: string;
  /** Hiç omurga işaretlenmemişse false — analiz anlamsız, çağıran taraf uyarı göstermeli. */
  hasBackbone: boolean;
  /** Analiz edilen switch'in kendisi omurga mı? */
  isBackboneTarget: boolean;
  /** Hedef kaldırıldıktan SONRA kaç omurga switch kalıyor (hepsi düşerse 0). */
  remainingBackboneCount: number;
  /** Hedef kaldırılmadan ÖNCE omurgaya gerçekten ulaşabiliyor muydu? (izole switch'ler için false) */
  targetWasReachable: boolean;
  /** Etkilenen switch'ler — HER ZAMAN hedefin kendisini içerir (varsa), artı omurga
   *  erişimini kaybeden diğer switch'ler. switchIds sırasına göre döner (deterministik). */
  affectedSwitchIds: string[];
  /** Hedef DIŞINDA en az bir switch etkileniyor mu — "bu switch kritik mi" sorusunun cevabı. */
  critical: boolean;
}

function buildAdjacency(nodeIds: string[], edges: [string, string][]): Map<string, Set<string>> {
  const nodes = new Set(nodeIds);
  const adjacency = new Map<string, Set<string>>();
  for (const id of nodeIds) adjacency.set(id, new Set());

  for (const [a, b] of edges) {
    if (!nodes.has(a) || !nodes.has(b) || a === b) continue;
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }
  return adjacency;
}

function bfsReachable(sources: string[], adjacency: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [];

  for (const s of sources) {
    if (!adjacency.has(s) || visited.has(s)) continue;
    visited.add(s);
    queue.push(s);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited;
}

export function computeBlastRadius(input: BlastRadiusInput): BlastRadiusResult {
  const { switchIds, edges, backboneIds, targetId } = input;

  const uniqueBackboneIds = Array.from(new Set(backboneIds)).filter((id) => switchIds.includes(id));

  if (uniqueBackboneIds.length === 0) {
    return {
      targetId,
      hasBackbone: false,
      isBackboneTarget: false,
      remainingBackboneCount: 0,
      targetWasReachable: false,
      affectedSwitchIds: [],
      critical: false
    };
  }

  const adjacencyBefore = buildAdjacency(switchIds, edges);
  const reachableBefore = bfsReachable(uniqueBackboneIds, adjacencyBefore);

  const remainingSwitchIds = switchIds.filter((id) => id !== targetId);
  const remainingBackboneIds = uniqueBackboneIds.filter((id) => id !== targetId);
  const edgesAfter = edges.filter(([a, b]) => a !== targetId && b !== targetId);
  const adjacencyAfter = buildAdjacency(remainingSwitchIds, edgesAfter);
  const reachableAfter = bfsReachable(remainingBackboneIds, adjacencyAfter);

  const lostReachability = switchIds.filter(
    (id) => id !== targetId && reachableBefore.has(id) && !reachableAfter.has(id)
  );

  const affectedSet = new Set(lostReachability);
  if (switchIds.includes(targetId)) affectedSet.add(targetId);

  return {
    targetId,
    hasBackbone: true,
    isBackboneTarget: uniqueBackboneIds.includes(targetId),
    remainingBackboneCount: remainingBackboneIds.length,
    targetWasReachable: reachableBefore.has(targetId),
    affectedSwitchIds: switchIds.filter((id) => affectedSet.has(id)),
    critical: lostReachability.length > 0
  };
}
