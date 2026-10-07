export type InventoryStatus = "aktif" | "arizali" | "yedek" | "hurda";

export interface InventoryItem {
  id: string;
  name: string;
  type: string;
  brand_model: string | null;
  serial_no: string | null;
  ip_address: string | null;
  location: string | null;
  status: InventoryStatus;
  purchase_date: string | null;
  warranty_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subnet {
  id: string;
  name: string;
  cidr: string;
  vlan_id: number | null;
  description: string | null;
  created_at: string;
}

export type IpAssignmentStatus = "kullanimda" | "bos" | "rezerve";

export interface IpAssignment {
  id: string;
  subnet_id: string | null;
  ip_address: string;
  device_name: string | null;
  inventory_id: string | null;
  status: IpAssignmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Switch {
  id: string;
  name: string;
  model: string | null;
  management_ip: string | null;
  port_count: number | null;
  sfp_count: number;
  vlans: string | null;
  location: string | null;
  notes: string | null;
  pos_x: number;
  pos_y: number;
  /** Düz metin, hassas — bkz. schema.sql yorumu. /api/switches yanıtlarında dönmez. */
  snmp_community: string | null;
  /** Etki analizi omurgası mı? (0/1, SQLite boolean). Birden fazla switch omurga olabilir. */
  is_backbone: number;
  created_at: string;
  updated_at: string;
}

/** /api/switches yanıtlarında döndürülen alanlar — snmp_community HARİÇ. */
export const SWITCH_PUBLIC_COLUMNS =
  "id, name, model, management_ip, port_count, sfp_count, vlans, location, notes, pos_x, pos_y, is_backbone, created_at, updated_at";

export interface SwitchLink {
  id: string;
  source_id: string;
  target_id: string;
  label: string | null;
  created_at: string;
}

export type TopologyAnnotationType = "region" | "text" | "shape";
export type TopologyAnnotationShapeKind = "box" | "arrow";

export interface TopologyAnnotation {
  id: string;
  type: TopologyAnnotationType;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  text: string | null;
  color: string | null;
  shape_kind: TopologyAnnotationShapeKind | null;
  z_order: number;
  created_at: string;
  updated_at: string;
}

export type SwitchPortStatus = "bos" | "dolu" | "kapali" | "uplink";
export type SwitchPortConnectionType = "inventory" | "switch" | "other";
export type SwitchPortType = "copper" | "sfp";

export interface SwitchPort {
  id: string;
  switch_id: string;
  port_number: number;
  port_type: SwitchPortType;
  label: string | null;
  status: SwitchPortStatus;
  connection_type: SwitchPortConnectionType | null;
  connected_inventory_id: string | null;
  connected_switch_id: string | null;
  connected_port_number: number | null;
  connected_label: string | null;
  vlan: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type TodoPriority = "dusuk" | "orta" | "yuksek";
export type TodoStatus = "bekliyor" | "devam_ediyor" | "tamam";

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  priority: TodoPriority;
  due_date: string | null;
  status: TodoStatus;
  related_inventory_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  title: string;
  tags: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export type UserRole = "admin" | "user";

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaultMeta {
  id: string;
  salt: string;
  kdf_n: number;
  kdf_r: number;
  kdf_p: number;
  verifier: string;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export type VaultCredentialTargetType = "switch" | "inventory" | "other";

export interface VaultCredential {
  id: string;
  target_type: VaultCredentialTargetType;
  target_id: string | null;
  label: string;
  username_encrypted: string;
  password_encrypted: string;
  notes_encrypted: string | null;
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  product_name: string;
  vendor: string | null;
  total_seats: number;
  purchase_date: string | null;
  start_date: string | null;
  renewal_date: string | null;
  cost: number | null;
  currency: string;
  /** "iv:authTag:ciphertext" (kasa formatı) veya NULL — bkz. schema.sql yorumu. */
  license_key_encrypted: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type LicenseAssignmentTargetType = "inventory" | "switch" | "other";

export interface LicenseAssignment {
  id: string;
  license_id: string;
  target_type: LicenseAssignmentTargetType;
  target_id: string | null;
  assigned_label: string;
  assigned_at: string;
  notes: string | null;
}

export type AttachmentOwnerType = "inventory" | "note" | "license";

export interface Attachment {
  id: string;
  owner_type: AttachmentOwnerType;
  owner_id: string;
  original_name: string;
  stored_name: string;
  size: number;
  mime_type: string | null;
  is_invoice: number;
  invoice_amount: number | null;
  invoice_currency: string | null;
  invoice_vendor: string | null;
  invoice_date: string | null;
  created_at: string;
}
