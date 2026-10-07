import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deriveSwitchPortEdges } from "./portLinkEdges";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  applyNodeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type NodeMouseHandler,
  type OnNodeDrag,
  type EdgeMouseHandler
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getBlastRadius, listSwitches, updateSwitchPosition } from "../../api/switches";
import { createSwitchLink, deleteSwitchLink, listSwitchLinks } from "../../api/switchLinks";
import { listSwitchPorts, updateSwitchPort } from "../../api/switchPorts";
import { listInventory } from "../../api/inventory";
import {
  createTopologyAnnotation,
  deleteTopologyAnnotation,
  listTopologyAnnotations,
  updateTopologyAnnotation
} from "../../api/topologyAnnotations";
import SwitchNode, { type SwitchNodeData } from "./SwitchNode";
import RegionNode, { type RegionNodeData } from "./RegionNode";
import PacketEdge, { type PacketEdgeData } from "./PacketEdge";
import AnnotationOverlay from "./AnnotationOverlay";
import TopologyToolbar from "./TopologyToolbar";
import AnnotationEditModal from "./AnnotationEditModal";
import { computeNodeSize } from "./portGridLayout";
import PortEditForm from "./PortEditForm";
import BlastRadiusPanel from "./BlastRadiusPanel";
import { useToast } from "../../components/Toast";
import Modal from "../../components/Modal";
import { usePingStatus } from "../../ping/PingStatusProvider";
import type {
  BlastRadiusResult,
  InventoryItem,
  Switch,
  SwitchPort,
  SwitchPortFormData,
  TopologyAnnotation
} from "../../types";

const NODE_TYPE = "switchNode";
const REGION_NODE_TYPE = "region";
const PACKET_EDGE_TYPE = "packetEdge";
// Çok fazla bağlantı olursa (nadir) animasyon katmanını devre dışı bırakıp
// performansı korumak için yumuşak bir üst sınır.
const MAX_ANIMATED_EDGES = 80;
// Paket akışının "birkaç saniye" aktif kalma süresi — PacketEdge'deki SMIL
// tekrar sayıları (HEALTHY_REPEAT/FAILING_REPEAT) zaten kendi başına bu
// pencereye yakın bir sürede doğal olarak (opacity 0'da) bitiyor; bu timer
// sadece işi tamamen DOM'dan temizler (o noktada paketler zaten görünmez).
const PACKET_ANIMATION_MS = 4200;
const REGION_DEFAULT_WIDTH = 220;
const REGION_DEFAULT_HEIGHT = 160;
const ANNOTATION_ID_PREFIX = "ann-";
const DEFAULT_TEXT_COLOR = "#c8850f";
const DEFAULT_REGION_COLOR = "#94a0b2";
const DEFAULT_SHAPE_COLOR = "#1670a6";
const BOX_DEFAULT_WIDTH = 180;
const BOX_DEFAULT_HEIGHT = 110;
const ARROW_DEFAULT_DX = 150;
const ARROW_DEFAULT_DY = 0;

function annotationIdFromNodeId(nodeId: string): string | null {
  return nodeId.startsWith(ANNOTATION_ID_PREFIX) ? nodeId.slice(ANNOTATION_ID_PREFIX.length) : null;
}

// count=1 -> düz çizgi (curvature 0). count>1 -> -0.5..+0.5 arasında eşit
// aralıklı, birbirinden ayrışan eğrilikler (yelpaze) — aynı node'a bağlı
// birden fazla çizgi (farklı komşulara ya da aynı komşuya paralel) artık
// tek noktada üst üste binmiyor.
function curvatureForIndex(index: number, count: number): number {
  if (count <= 1) return 0;
  const spread = 1.1;
  const step = (2 * spread) / (count - 1);
  return -spread + step * index;
}

export default function TopologyTab() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [switches, setSwitches] = useState<Switch[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [annotations, setAnnotations] = useState<TopologyAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSwitches, setHasSwitches] = useState(true);
  const [editingPort, setEditingPort] = useState<{ switchId: string; port: SwitchPort } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState<TopologyAnnotation | null>(null);
  const flowWrapperRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { result: pingResult, loading: pingLoading, runCheck } = usePingStatus();

  // Etki analizi (blast radius) — ping/paket katmanlarından TAMAMEN bağımsız
  // bir mod. `impactMode` kapalıyken node tıklaması hiçbir şey yapmaz (mevcut
  // davranış — port tıklama/sürükleme aynen çalışır). Açıkken bir switch'e
  // tıklamak o an için GET /api/switches/:id/blast-radius çağırır; sonuç
  // gelene kadar `blastLoading`, hata olursa `blastError` gösterilir. Panel
  // kapanınca veya mod kapatılınca hepsi sıfırlanır — boyama (impactState)
  // sadece `blastResult` doluyken hesaplanır.
  const [impactMode, setImpactMode] = useState(false);
  const [blastTarget, setBlastTarget] = useState<{ id: string; name: string } | null>(null);
  const [blastResult, setBlastResult] = useState<BlastRadiusResult | null>(null);
  const [blastLoading, setBlastLoading] = useState(false);
  const [blastError, setBlastError] = useState<string | null>(null);

  function resetImpactAnalysis() {
    setBlastTarget(null);
    setBlastResult(null);
    setBlastError(null);
  }

  function toggleImpactMode() {
    setImpactMode((v) => !v);
    resetImpactAnalysis();
  }

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!impactMode) return;
      if (annotationIdFromNodeId(node.id)) return; // bölge/not — switch değil
      const switchItem = switches.find((s) => s.id === node.id);
      if (!switchItem) return;

      setBlastTarget({ id: switchItem.id, name: switchItem.name });
      setBlastResult(null);
      setBlastError(null);
      setBlastLoading(true);
      getBlastRadius(switchItem.id)
        .then(setBlastResult)
        .catch((err) => setBlastError(err instanceof Error ? err.message : "Etki analizi başarısız oldu"))
        .finally(() => setBlastLoading(false));
    },
    [impactMode, switches]
  );

  // Paket akış animasyonu GEÇİCİ: kontrol sonrası bir süre akıp otomatik
  // durur. Çevrimdışı switch'lerin kırmızı göstergesi bundan bağımsız,
  // pingResult'a bağlı olarak KALICI kalır (bkz. offlineSwitchIds altta) —
  // bu ikisi bilinçli olarak ayrı state. SMIL animasyonları PacketEdge
  // içinde HER ZAMAN indefinite döngüde çalışır (sonlu repeatCount bu
  // tarayıcıda animasyonu hiç başlatmıyor — bkz. PacketEdge.tsx yorumu);
  // görünürlük sadece `packetsActive`'e bağlı CSS opacity ile kontrol edilir.
  const [packetsActive, setPacketsActive] = useState(false);
  const packetsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (packetsTimerRef.current) clearTimeout(packetsTimerRef.current);
    };
  }, []);

  async function handlePingCheck() {
    await runCheck();
    setPacketsActive(true);
    if (packetsTimerRef.current) clearTimeout(packetsTimerRef.current);
    packetsTimerRef.current = setTimeout(() => setPacketsActive(false), PACKET_ANIMATION_MS);
  }

  const nodeTypes = useMemo(() => ({ [NODE_TYPE]: SwitchNode, [REGION_NODE_TYPE]: RegionNode }), []);
  const edgeTypes = useMemo(() => ({ [PACKET_EDGE_TYPE]: PacketEdge }), []);

  const handlePortClick = useCallback((switchId: string, port: SwitchPort) => {
    setEditingPort({ switchId, port });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [switchList, links, inv, annotationList] = await Promise.all([
          listSwitches(),
          listSwitchLinks(),
          listInventory({}),
          listTopologyAnnotations().catch(() => [])
        ]);
        setHasSwitches(switchList.length > 0);
        setSwitches(switchList);
        setInventory(inv);
        setAnnotations(annotationList);

        const portsPerSwitch = await Promise.all(
          switchList.map((s) => listSwitchPorts(s.id).catch(() => []))
        );

        setNodes(
          switchList.map((s, i) => {
            const ports = portsPerSwitch[i];
            const copperCount = ports.filter((p) => p.port_type !== "sfp").length;
            const sfpCount = ports.filter((p) => p.port_type === "sfp").length;
            const { width, height } = computeNodeSize(copperCount, sfpCount);
            return {
              id: s.id,
              type: NODE_TYPE,
              position: { x: s.pos_x, y: s.pos_y },
              // @xyflow/react bir node'u ResizeObserver ile ölçene kadar visibility:hidden
              // tutuyor (bağlantı kurulamaz hale geliyor). width/height'ı port_count'a göre
              // hesaplayıp yine de AÇIKÇA veriyoruz — ölçüm gecikmesini/başarısızlığını
              // devre dışı bırakmak için (bkz. portGridLayout.ts).
              width,
              height,
              data: {
                label: s.name,
                model: s.model,
                managementIp: s.management_ip,
                portCount: s.port_count,
                ports,
                allSwitches: switchList,
                inventory: inv,
                onPortClick: handlePortClick
              } satisfies SwitchNodeData
            };
          })
        );
        setEdges(
          links.map((l) => ({
            id: l.id,
            source: l.source_id,
            target: l.target_id,
            label: l.label ?? undefined
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Yüklenemedi");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [handlePortClick]);

  // Değişiklikleri switch/annotation diye ikiye ayırıyoruz: switch node'ları
  // `nodes` state'inde (applyNodeChanges ile, eskisi gibi), annotation
  // node'ları (id `ann-` ile başlar) `annotations` state'inde x/y güncellenerek
  // sürükleme sırasında ANLIK görsel geri bildirim veriyor. Asıl kayıt (PATCH)
  // sürükleme BİTİNCE onNodeDragStop'ta tek seferde atılıyor (spam yok) —
  // switch'lerdeki AYNI desen.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const switchChanges = changes.filter((c) => !("id" in c) || !annotationIdFromNodeId(c.id));
    const annotationPositionChanges = changes.filter(
      (c): c is Extract<NodeChange, { type: "position" }> =>
        c.type === "position" && !!annotationIdFromNodeId(c.id) && !!c.position
    );

    if (switchChanges.length > 0) {
      setNodes((nds) => applyNodeChanges(switchChanges, nds));
    }
    if (annotationPositionChanges.length > 0) {
      setAnnotations((prev) =>
        prev.map((a) => {
          const change = annotationPositionChanges.find((c) => annotationIdFromNodeId(c.id) === a.id);
          return change?.position ? { ...a, x: change.position.x, y: change.position.y } : a;
        })
      );
    }
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback((_event, node) => {
    const annotationId = annotationIdFromNodeId(node.id);
    if (annotationId) {
      updateTopologyAnnotation(annotationId, { x: node.position.x, y: node.position.y }).catch((err) => {
        console.error("Not/bölge konumu kaydedilemedi:", err);
      });
      return;
    }
    updateSwitchPosition(node.id, node.position.x, node.position.y).catch((err) => {
      console.error("Konum kaydedilemedi:", err);
    });
  }, []);

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!editMode) return;
      const annotationId = annotationIdFromNodeId(node.id);
      if (!annotationId) return;
      const annotation = annotations.find((a) => a.id === annotationId);
      if (annotation) setEditingAnnotation(annotation);
    },
    [editMode, annotations]
  );

  async function handleAddRegion(x: number, y: number) {
    try {
      const created = await createTopologyAnnotation({
        type: "region",
        x,
        y,
        width: REGION_DEFAULT_WIDTH,
        height: REGION_DEFAULT_HEIGHT,
        text: "Yeni Bölge",
        color: DEFAULT_REGION_COLOR,
        shape_kind: null
      });
      setAnnotations((prev) => [...prev, created]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bölge eklenemedi", "danger");
    }
  }

  async function handleAddText(x: number, y: number) {
    try {
      const created = await createTopologyAnnotation({
        type: "text",
        x,
        y,
        width: null,
        height: null,
        text: "Yeni not",
        color: DEFAULT_TEXT_COLOR,
        shape_kind: null
      });
      setAnnotations((prev) => [...prev, created]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Not eklenemedi", "danger");
    }
  }

  async function handleAddBox(x: number, y: number) {
    try {
      const created = await createTopologyAnnotation({
        type: "shape",
        x: x - BOX_DEFAULT_WIDTH / 2,
        y: y - BOX_DEFAULT_HEIGHT / 2,
        width: BOX_DEFAULT_WIDTH,
        height: BOX_DEFAULT_HEIGHT,
        text: null,
        color: DEFAULT_SHAPE_COLOR,
        shape_kind: "box"
      });
      setAnnotations((prev) => [...prev, created]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Kutu eklenemedi", "danger");
    }
  }

  async function handleAddArrow(x: number, y: number) {
    try {
      const created = await createTopologyAnnotation({
        type: "shape",
        x: x - ARROW_DEFAULT_DX / 2,
        y,
        width: ARROW_DEFAULT_DX,
        height: ARROW_DEFAULT_DY,
        text: null,
        color: DEFAULT_SHAPE_COLOR,
        shape_kind: "arrow"
      });
      setAnnotations((prev) => [...prev, created]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Ok eklenemedi", "danger");
    }
  }

  async function handleSaveAnnotation(data: { text: string | null; color: string | null }) {
    if (!editingAnnotation) return;
    const updated = await updateTopologyAnnotation(editingAnnotation.id, {
      text: data.text,
      color: data.color
    });
    setAnnotations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditingAnnotation(null);
  }

  async function handleDeleteAnnotation() {
    if (!editingAnnotation) return;
    await deleteTopologyAnnotation(editingAnnotation.id);
    setAnnotations((prev) => prev.filter((a) => a.id !== editingAnnotation.id));
    setEditingAnnotation(null);
  }

  // Taşımadaki AYNI ikili desen: sürükleme SIRASINDA (onResize) her adımda
  // SADECE local `annotations` state'i güncellenir (API çağrısı YOK) — bu,
  // node'un width/height/x/y'sinin (annotations state'inden gelen) her karede
  // tazelenmesini sağlayıp mouse'u CANLI takip etmesini sağlıyor (önceki halde
  // bu eksikti: sadece onResizeEnd'e bağlıydı, o yüzden kutu sürükleme
  // sırasında donuk duruyordu). Sürükleme BİTİNCE (onResizeEnd) ise tek bir
  // PATCH atılır — spam yok.
  //
  // clampDims: NodeResizer kendi minWidth/minHeight'ını genelde uyguluyor, ama
  // canlı önizleme koptuğunda (bu turdaki bug) ara sıra negatif/eksi değer
  // sızabildiği görüldü (gerçek bir kayıtta width:-68 bulundu) — burada ekstra
  // bir güvenlik ağı olarak DB'ye asla minimumun altında/negatif değer
  // gitmeyecek şekilde clamp'liyoruz.
  const MIN_REGION_SIZE = 60;
  function clampDims(dims: { x: number; y: number; width: number; height: number }) {
    return { ...dims, width: Math.max(MIN_REGION_SIZE, dims.width), height: Math.max(MIN_REGION_SIZE, dims.height) };
  }

  const handleRegionResize = useCallback(
    (annotationId: string, dims: { x: number; y: number; width: number; height: number }) => {
      const clamped = clampDims(dims);
      setAnnotations((prev) => prev.map((a) => (a.id === annotationId ? { ...a, ...clamped } : a)));
    },
    []
  );

  const handleRegionResizeEnd = useCallback(
    (annotationId: string, dims: { x: number; y: number; width: number; height: number }) => {
      const clamped = clampDims(dims);
      setAnnotations((prev) => prev.map((a) => (a.id === annotationId ? { ...a, ...clamped } : a)));
      updateTopologyAnnotation(annotationId, clamped).catch((err) => {
        console.error("Bölge boyutu kaydedilemedi:", err);
      });
    },
    []
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) {
        showToast("Bir switch kendine bağlanamaz.", "danger");
        return;
      }
      const exists = edges.some(
        (e) =>
          (e.source === connection.source && e.target === connection.target) ||
          (e.source === connection.target && e.target === connection.source)
      );
      if (exists) {
        showToast("Bu iki switch arasında zaten bir bağlantı var.", "danger");
        return;
      }

      const promptResult = window.prompt("Bağlantı etiketi (opsiyonel):", "");
      if (promptResult === null) return;
      const label = promptResult.trim() || null;

      try {
        const link = await createSwitchLink(connection.source, connection.target, label);
        setEdges((eds) =>
          addEdge({ id: link.id, source: link.source_id, target: link.target_id, label: link.label ?? undefined }, eds)
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Bağlantı oluşturulamadı", "danger");
      }
    },
    [edges, showToast]
  );

  const handleDeleteEdge = useCallback(
    async (edge: Edge) => {
      try {
        await deleteSwitchLink(edge.id);
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Bağlantı silinemedi", "danger");
      }
    },
    [showToast]
  );

  // Port-türetilmiş (dashed/noktalı) edge'ler salt gösterim — silinemez/
  // düzenlenemez, bağlantı porttan yönetilir. Sadece elle çizilen switch_links
  // edge'leri (data.derived olmayanlar) çift tık/sağ tık ile silinebilir.
  const onEdgeDoubleClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      if (edge.data?.derived) return;
      handleDeleteEdge(edge);
    },
    [handleDeleteEdge]
  );

  const onEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault();
      if (edge.data?.derived) return;
      handleDeleteEdge(edge);
    },
    [handleDeleteEdge]
  );

  // Çift taraflı port senkronu (Aşama 4) bir portu kaydederken KARŞI switch'in
  // portunu da sunucu tarafında güncelleyebilir (otomatik doldurma/boşaltma).
  // Bu yüzden tek bir portu yerel state'te yamamak yetmez — hem port-türetilmiş
  // edge'lerin hem de karşı node'un port ızgarasının güncel kalması için tüm
  // switch'lerin portlarını yeniden çekiyoruz (yerel uygulama, switch sayısı az).
  async function refreshAllPorts() {
    const results = await Promise.all(
      switches.map((s) => listSwitchPorts(s.id).catch(() => null))
    );
    setNodes((nds) =>
      nds.map((n) => {
        const idx = switches.findIndex((s) => s.id === n.id);
        const ports = idx !== -1 ? results[idx] : null;
        if (!ports) return n;
        const nodeData = n.data as SwitchNodeData;
        return { ...n, data: { ...nodeData, ports } };
      })
    );
  }

  async function handleSavePort(data: SwitchPortFormData) {
    if (!editingPort) return;
    const result = await updateSwitchPort(editingPort.port.id, data);
    await refreshAllPorts();
    setEditingPort(null);
    if (result.warning) {
      showToast(result.warning, "danger");
    }
  }

  const portsBySwitchId = useMemo(() => {
    const map = new Map<string, SwitchPort[]>();
    for (const n of nodes) {
      map.set(n.id, (n.data as SwitchNodeData).ports ?? []);
    }
    return map;
  }, [nodes]);

  const portLinkEdges = useMemo(
    () => deriveSwitchPortEdges(switches, portsBySwitchId),
    [switches, portsBySwitchId]
  );

  // Bir node'a (ör. Core Switch) birden fazla çizgi bağlıysa (farklı
  // komşulara VEYA aynı komşuya paralel birden fazla kabloyla), hepsi aynı
  // sabit üst/alt bağlantı noktasından çıktığı için üst üste biniyordu.
  // Çözüm: her node için ona dokunan çizgileri komşu id'sine göre sabit bir
  // sırayla diz, her birine 0..N-1 bir rütbe (rank) ver; çizginin İKİ ucundan
  // "daha kalabalık" olanın rütbesini kullanarak -0.5..+0.5 arasında farklı
  // bir eğrilik (curvature) ata. Bu, react-flow'un yerleşik bezier kenarını
  // kullanır (özel bir edge bileşeni GEREKTİRMEZ) — çizgiler yelpaze gibi
  // ayrışır, etiketleri de eğriyle birlikte otomatik olarak ayrı konumlara
  // düşer (react-flow etiketi path'in orta noktasına yerleştiriyor).
  // Son ping sonucundan çevrimdışı switch id'lerini çıkar — pingResult null
  // ise (henüz hiç kontrol edilmedi) set boş kalır, hiçbir switch/bağlantı
  // kırmızı görünmez (varsayılan/normal görünüm). Backend management_ip'siz
  // switch'lere zaten ping atmadığı için onlar bu sete asla giremez.
  const offlineSwitchIds = useMemo(
    () => new Set((pingResult?.offlineSwitches ?? []).map((s) => s.id)),
    [pingResult]
  );

  const allEdges = useMemo(() => {
    const combined = [...edges, ...portLinkEdges];

    const touchList = new Map<string, { edgeId: string; neighborId: string }[]>();
    const addTouch = (nodeId: string, edgeId: string, neighborId: string) => {
      const list = touchList.get(nodeId) ?? [];
      list.push({ edgeId, neighborId });
      touchList.set(nodeId, list);
    };
    for (const e of combined) {
      addTouch(e.source, e.id, e.target);
      addTouch(e.target, e.id, e.source);
    }

    const rankAt = new Map<string, { rank: number; count: number }>();
    for (const [nodeId, list] of touchList) {
      const sorted = [...list].sort((a, b) =>
        (a.neighborId + a.edgeId).localeCompare(b.neighborId + b.edgeId)
      );
      sorted.forEach((item, idx) => {
        rankAt.set(`${nodeId}::${item.edgeId}`, { rank: idx, count: sorted.length });
      });
    }

    // Ping hiç çalıştırılmadıysa VEYA bağlantı sayısı performans sınırını
    // aşıyorsa hiçbir edge'e `packet` verisi verilmez — PacketEdge bu
    // durumda animasyon elemanı hiç render etmez. Kontrol yapıldıysa packet
    // verisi HER ZAMAN eklenir (SMIL arka planda indefinite döngüde kalır,
    // ucuzdur); görünürlük `active` alanı üzerinden CSS opacity ile
    // `packetsActive`e bağlanır. Çevrimdışı switch'lerin kırmızı göstergesi
    // (offlineSwitchIds) bundan TAMAMEN bağımsız, ayrıca hesaplanıp kalıcı
    // kalıyor.
    const attachPackets = pingResult !== null && combined.length <= MAX_ANIMATED_EDGES;

    return combined.map((e) => {
      const atSource = rankAt.get(`${e.source}::${e.id}`) ?? { rank: 0, count: 1 };
      const atTarget = rankAt.get(`${e.target}::${e.id}`) ?? { rank: 0, count: 1 };
      const busier = atSource.count >= atTarget.count ? atSource : atTarget;

      let packet: PacketEdgeData["packet"];
      if (attachPackets) {
        const sourceOffline = offlineSwitchIds.has(e.source);
        const targetOffline = offlineSwitchIds.has(e.target);
        packet =
          sourceOffline || targetOffline
            ? { state: "failing", reverse: sourceOffline && !targetOffline, active: packetsActive }
            : { state: "healthy", reverse: false, active: packetsActive };
      }

      return {
        ...e,
        type: PACKET_EDGE_TYPE,
        pathOptions: { curvature: curvatureForIndex(busier.rank, busier.count) },
        data: { ...(e.data as Record<string, unknown> | undefined), packet } satisfies PacketEdgeData
      };
    });
  }, [edges, portLinkEdges, pingResult, offlineSwitchIds, packetsActive]);

  // Bölge (region) kutuları. Switch node'larının ALTINDA durmaları için ÇİFT
  // garanti: (1) düşük zIndex, (2) `allNodes` dizisinde switch node'larından
  // ÖNCE gelmeleri (react-flow, aynı zIndex'te sonraki DOM elemanını üstte
  // gösterir). width/height DB'den geliyor, ölçüme bırakılmıyor (SwitchNode
  // ile aynı prensip — bkz. portGridLayout.ts yorumu).
  //
  // draggable/selectable/pointerEvents Düzenleme Modu'na göre değişir: mod
  // kapalıyken false/none (salt gösterim, switch'e hiç karışmaz), mod
  // açıkken true/auto (taşınabilir/seçilebilir) — ama switch her zaman SONRA
  // render edilip daha yüksek zIndex'te olduğundan, region'ın pointer-events'i
  // açık olsa bile switch'in kapladığı alanda olaylar switch'e gider.
  const regionNodes = useMemo<Node[]>(
    () =>
      annotations
        .filter((a) => a.type === "region")
        .map((a) => ({
          id: `ann-${a.id}`,
          type: REGION_NODE_TYPE,
          position: { x: a.x, y: a.y },
          width: a.width ?? REGION_DEFAULT_WIDTH,
          height: a.height ?? REGION_DEFAULT_HEIGHT,
          draggable: editMode,
          selectable: editMode,
          connectable: false,
          zIndex: -1,
          data: {
            label: a.text,
            color: a.color,
            editMode,
            onResize: (dims: { x: number; y: number; width: number; height: number }) =>
              handleRegionResize(a.id, dims),
            onResizeEnd: (dims: { x: number; y: number; width: number; height: number }) =>
              handleRegionResizeEnd(a.id, dims)
          } satisfies RegionNodeData
        })),
    [annotations, editMode, handleRegionResize, handleRegionResizeEnd]
  );

  // Serbest metin notları ARTIK react-flow node'u DEĞİL — bkz. AnnotationOverlay.tsx.
  const textAnnotations = useMemo(() => annotations.filter((a) => a.type === "text"), [annotations]);

  // Kutu/ok da aynı sebeple (z-index/sürükleme sorunlarından tamamen bağımsız
  // kalmak için) react-flow node'u değil, AnnotationOverlay içinde render
  // ediliyor — switch'lerin ÖNÜNDE (vurgu/işaretleme amaçlı), ama mod
  // kapalıyken pointerEvents:none olduğu için tıklamayı asla çalmıyor.
  const shapeAnnotations = useMemo(() => annotations.filter((a) => a.type === "shape"), [annotations]);

  const handleShapeChange = useCallback(
    (id: string, dims: { x: number; y: number; width: number; height: number }) => {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...dims } : a)));
    },
    []
  );

  const handleShapeChangeEnd = useCallback(
    (id: string, dims: { x: number; y: number; width: number; height: number }) => {
      setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...dims } : a)));
      updateTopologyAnnotation(id, dims).catch((err) => {
        console.error("Şekil kaydedilemedi:", err);
      });
    },
    []
  );

  // Overlay'deki sürükleme: switch/region ile AYNI desen — sürüklerken SADECE
  // local state (canlı, akıcı önizleme), bırakınca TEK PATCH.
  const handleAnnotationLiveMove = useCallback((id: string, x: number, y: number) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)));
  }, []);

  const handleAnnotationMoveEnd = useCallback((id: string, x: number, y: number) => {
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, x, y } : a)));
    updateTopologyAnnotation(id, { x, y }).catch((err) => {
      console.error("Not konumu kaydedilemedi:", err);
    });
  }, []);

  // `nodes` state'inin kendisine DOKUNMADAN (pozisyon/port verisi orada
  // otoriter kalır) her switch node'unun `data`sına salt-okunur bir
  // `isOffline` bayrağı ekleyerek türetilmiş bir kopya oluşturuyoruz — ping
  // sonucu değiştiğinde sadece görsel katman güncellenir.
  const switchNodesWithPingStatus = useMemo(
    () =>
      nodes.map((n) =>
        offlineSwitchIds.has(n.id)
          ? { ...n, data: { ...(n.data as SwitchNodeData), isOffline: true } }
          : n.data && (n.data as SwitchNodeData).isOffline
            ? { ...n, data: { ...(n.data as SwitchNodeData), isOffline: false } }
            : n
      ),
    [nodes, offlineSwitchIds]
  );

  // Etki analizi boyaması — isOffline'la AYNI ilke: `nodes`/ping katmanına
  // dokunmadan üstüne salt-okunur bir `impactState` ekleniyor. blastResult
  // yoksa (analiz kapalı/henüz sonuç gelmedi) her node "normal" (impactState
  // undefined) kalır.
  const affectedSwitchIdSet = useMemo(
    () => new Set(blastResult?.affectedSwitchIds ?? []),
    [blastResult]
  );

  const switchNodesWithImpact = useMemo(() => {
    if (!blastTarget || !blastResult) return switchNodesWithPingStatus;
    return switchNodesWithPingStatus.map((n) => {
      if (n.id === blastTarget.id) {
        return { ...n, data: { ...(n.data as SwitchNodeData), impactState: "root" as const } };
      }
      if (affectedSwitchIdSet.has(n.id)) {
        return { ...n, data: { ...(n.data as SwitchNodeData), impactState: "affected" as const } };
      }
      return n;
    });
  }, [switchNodesWithPingStatus, blastTarget, blastResult, affectedSwitchIdSet]);

  const allNodes = useMemo(
    () => [...regionNodes, ...switchNodesWithImpact],
    [regionNodes, switchNodesWithImpact]
  );

  if (loading) {
    return <p className="text-sm text-tertiary">Yükleniyor...</p>;
  }

  return (
    <div>
      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      {!hasSwitches && (
        <p className="text-sm text-tertiary mb-3">
          Henüz switch eklenmedi. Önce "Detay/Kart" sekmesinden switch ekleyin.
        </p>
      )}
      <p className="text-xs text-tertiary mb-2">
        Bağlantı çizmek için bir switch'in kenarından diğerine sürükleyin. Bağlantıyı silmek için çift tıklayın
        veya sağ tıklayın. Bir porta tıklayarak düzenleyebilirsiniz. Noktalı turuncu çizgiler SFP/fiber port
        kayıtlarından otomatik türetilir (ör. "24 ↔ 1") ve porttan yönetilir (bakır port bağlantıları topolojide
        çizilmez, sadece kart sekmesinde görünür); düz/kalın çizgiler elle eklediğiniz bağlantılardır. Sağ üstteki
        "Düzenleme Modu" açıkken bölge/not ekleyip taşıyabilir, çift tıklayarak düzenleyebilirsiniz.
      </p>
      {impactMode && (
        <p className="text-xs text-accent mb-2">
          ⚡ Etki Analizi açık — bir switch'e tıklayın, o düşerse ne etkileneceğini gösterelim.
        </p>
      )}
      <div ref={flowWrapperRef} className="h-[600px] w-full rounded-lg border bg-surface">
        <ReactFlow
          nodes={allNodes}
          edges={allEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeClick={onNodeClick}
          onConnect={onConnect}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onEdgeContextMenu={onEdgeContextMenu}
          // react-flow varsayılan olarak seçili/sürüklenen node'u OTOMATİK
          // olarak en üste taşır (elevateNodesOnSelect) — region'ın switch'lerin
          // ALTINDA sabit kalması gereken zIndex:-1'ini bozmasın diye kapalı.
          elevateNodesOnSelect={false}
          fitView
        >
          <Background />
          <Controls />
          <TopologyToolbar
            editMode={editMode}
            onToggleEditMode={() => setEditMode((v) => !v)}
            onAddRegion={handleAddRegion}
            onAddText={handleAddText}
            onAddBox={handleAddBox}
            onAddArrow={handleAddArrow}
            wrapperRef={flowWrapperRef}
            onPingCheck={handlePingCheck}
            pingLoading={pingLoading}
            impactMode={impactMode}
            onToggleImpactMode={toggleImpactMode}
          />
          {/* Metin notları react-flow node'u DEĞİL — react-flow'un sürükleme/
              seçim sırasındaki DOM/z-index davranışından TAMAMEN bağımsız
              olsun diye ayrı bir overlay katmanı (bkz. AnnotationOverlay.tsx).
              useViewport() kullanabilmesi için <ReactFlow>'un İÇİNDE render
              ediliyor (ReactFlowProvider bağlamı burada). */}
          <AnnotationOverlay
            annotations={textAnnotations}
            shapeAnnotations={shapeAnnotations}
            editMode={editMode}
            onLiveMove={handleAnnotationLiveMove}
            onMoveEnd={handleAnnotationMoveEnd}
            onShapeMove={handleShapeChange}
            onShapeMoveEnd={handleShapeChangeEnd}
            onDoubleClick={setEditingAnnotation}
          />
        </ReactFlow>
      </div>

      {editingPort && (
        <Modal title={`Port ${editingPort.port.port_number}`} onClose={() => setEditingPort(null)}>
          <PortEditForm
            port={editingPort.port}
            switches={switches.filter((s) => s.id !== editingPort.switchId)}
            inventory={inventory}
            onSubmit={handleSavePort}
            onCancel={() => setEditingPort(null)}
          />
        </Modal>
      )}

      {editingAnnotation && (
        <Modal
          title={
            editingAnnotation.type === "region"
              ? "Bölge Düzenle"
              : editingAnnotation.type === "text"
                ? "Not Düzenle"
                : editingAnnotation.shape_kind === "box"
                  ? "Kutu Düzenle"
                  : "Ok Düzenle"
          }
          onClose={() => setEditingAnnotation(null)}
        >
          <AnnotationEditModal
            annotation={editingAnnotation}
            onSave={handleSaveAnnotation}
            onDelete={handleDeleteAnnotation}
            onCancel={() => setEditingAnnotation(null)}
          />
        </Modal>
      )}

      {blastTarget && blastLoading && (
        <Modal title={`Etki Analizi — ${blastTarget.name}`} onClose={resetImpactAnalysis}>
          <p className="text-sm text-tertiary">Hesaplanıyor...</p>
        </Modal>
      )}

      {blastTarget && blastError && (
        <Modal title={`Etki Analizi — ${blastTarget.name}`} onClose={resetImpactAnalysis}>
          <p className="text-sm text-danger">{blastError}</p>
        </Modal>
      )}

      {blastTarget && blastResult && (
        <BlastRadiusPanel targetName={blastTarget.name} result={blastResult} onClose={resetImpactAnalysis} />
      )}
    </div>
  );
}
