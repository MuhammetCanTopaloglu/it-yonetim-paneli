/**
 * SwitchNode'daki port ızgarasının boyut hesabı — TopologyTab (node.width/height
 * olarak react-flow'a AÇIKÇA verilen değer) ve SwitchNode (gerçek çizim) burayı
 * ORTAK kullanır ki ikisi birbirinden asla sapmasın (aksi halde ya kırpılma ya
 * da boşluk oluşur). Sabit değer yerine ResizeObserver'a güvenmeme sebebi:
 * @xyflow/react bir node'u ölçene kadar visibility:hidden yapıyor — bu daha
 * önce topolojide "bağlantı kurulamıyor" bug'ına sebep olmuştu.
 */
export const PORT_SIZE = 14;
export const PORT_GAP = 3;
export const PORTS_PER_ROW = 12;
export const HEADER_HEIGHT = 38;
export const PADDING = 10;
export const MIN_WIDTH = 150;
export const EMPTY_HEIGHT = 42;

// SFP grubu için: bakır ızgarayla arasındaki ayraç + "SFP" küçük başlık —
// abartısız, ufak. sfp_count=0 olan switch'lerde bu tamamen 0 katkı yapar,
// yani eski görünüm birebir korunur.
export const SFP_SEPARATOR_GAP = 6;
export const SFP_LABEL_HEIGHT = 12;

export interface GroupLayout {
  count: number;
  rows: number;
  portsPerRow: number;
  gridWidth: number;
  gridHeight: number;
}

function computeGroupLayout(count: number): GroupLayout {
  if (count <= 0) {
    return { count: 0, rows: 0, portsPerRow: 0, gridWidth: 0, gridHeight: 0 };
  }
  const portsPerRow = Math.min(count, PORTS_PER_ROW);
  const rows = Math.ceil(count / portsPerRow);
  const gridWidth = portsPerRow * PORT_SIZE + (portsPerRow - 1) * PORT_GAP;
  const gridHeight = rows * PORT_SIZE + (rows - 1) * PORT_GAP;
  return { count, rows, portsPerRow, gridWidth, gridHeight };
}

export interface NodeSize {
  width: number;
  height: number;
  gridWidth: number;
  copper: GroupLayout;
  sfp: GroupLayout;
}

export function computeNodeSize(copperCount: number, sfpCount = 0): NodeSize {
  const copper = computeGroupLayout(copperCount > 0 ? copperCount : 0);
  const sfp = computeGroupLayout(sfpCount > 0 ? sfpCount : 0);

  if (copper.count === 0 && sfp.count === 0) {
    return { width: MIN_WIDTH, height: EMPTY_HEIGHT, gridWidth: 0, copper, sfp };
  }

  const gridWidth = Math.max(copper.gridWidth, sfp.gridWidth);
  const extraForSfp = sfp.count > 0 ? SFP_SEPARATOR_GAP + SFP_LABEL_HEIGHT + sfp.gridHeight : 0;
  const totalGridHeight = copper.gridHeight + extraForSfp;

  const width = Math.max(MIN_WIDTH, gridWidth + PADDING * 2);
  const height = HEADER_HEIGHT + totalGridHeight + PADDING * 2;

  return { width, height, gridWidth, copper, sfp };
}
