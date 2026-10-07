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

export type InventoryFormData = Omit<InventoryItem, "id" | "created_at" | "updated_at">;

export interface Subnet {
  id: string;
  name: string;
  cidr: string;
  vlan_id: number | null;
  description: string | null;
  created_at: string;
}

export type SubnetFormData = Omit<Subnet, "id" | "created_at">;

export type SubnetPool =
  | { valid: false; cidr: string }
  | {
      valid: true;
      cidr: string;
      prefix: number;
      networkAddress: string;
      broadcastAddress: string;
      totalUsable: number;
      used: number;
      free: number;
      percentUsed: number;
      isLarge: boolean;
      freeSample: string[];
      nextFree: string | null;
      sampleTruncated: boolean;
    };

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
  inventory_name?: string | null;
  subnet_name?: string | null;
}

export type IpAssignmentFormData = Omit<
  IpAssignment,
  "id" | "created_at" | "updated_at" | "inventory_name" | "subnet_name"
>;

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
  /** Etki analizi omurgası mı? (birden fazla switch omurga olabilir). */
  is_backbone: number;
  created_at: string;
  updated_at: string;
}

export type SwitchFormData = Omit<Switch, "id" | "pos_x" | "pos_y" | "created_at" | "updated_at">;

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

export type TopologyAnnotationCreateData = Pick<
  TopologyAnnotation,
  "type" | "x" | "y" | "width" | "height" | "text" | "color" | "shape_kind"
>;

export type TopologyAnnotationUpdateData = Partial<TopologyAnnotationCreateData>;

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

export type SwitchPortFormData = Pick<
  SwitchPort,
  | "label"
  | "status"
  | "connection_type"
  | "connected_inventory_id"
  | "connected_switch_id"
  | "connected_port_number"
  | "connected_label"
  | "vlan"
  | "notes"
>;

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

export type TodoFormData = Omit<Todo, "id" | "sort_order" | "created_at" | "updated_at" | "status">;

export interface Note {
  id: string;
  title: string;
  tags: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export type NoteFormData = Omit<Note, "id" | "created_at" | "updated_at">;

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

export interface InvoiceInput {
  amount?: string;
  currency?: string;
  vendor?: string;
  date?: string;
}

export type ChangelogAction = "create" | "update" | "delete" | "note";

export interface ChangelogEntry {
  id: string;
  table_name: string;
  record_id: string | null;
  action: ChangelogAction;
  description: string;
  created_at: string;
}

export interface DashboardCounts {
  totalSwitches: number;
  totalInventory: number;
  openTasks: number;
  faultyInventory: number;
  totalSubnets: number;
  totalIpAssignments: number;
}

export interface WarrantyItem {
  id: string;
  name: string;
  type: string;
  warranty_until: string;
  daysRemaining: number;
}

export interface WarrantyStatus {
  expired: WarrantyItem[];
  upcoming: WarrantyItem[];
}

export interface LicenseRenewalItem {
  id: string;
  product_name: string;
  renewal_date: string;
  daysRemaining: number;
}

export interface LicenseRenewalStatus {
  expired: LicenseRenewalItem[];
  upcoming: LicenseRenewalItem[];
}

export interface DashboardData {
  counts: DashboardCounts;
  upcomingTasks: Todo[];
  recentChangelog: ChangelogEntry[];
  warranty: WarrantyStatus;
  criticalTodos: Todo[];
  licenseRenewal: LicenseRenewalStatus;
}

export interface SearchSwitchResult {
  id: string;
  name: string;
  model: string | null;
  management_ip: string | null;
  location: string | null;
}

export interface SearchInventoryResult {
  id: string;
  name: string;
  type: string;
  serial_no: string | null;
  brand_model: string | null;
  ip_address: string | null;
  location: string | null;
}

export interface SearchIpAssignmentResult {
  id: string;
  ip_address: string;
  device_name: string | null;
  subnet_name: string | null;
}

export interface SearchNoteResult {
  id: string;
  title: string;
  tags: string | null;
}

export interface SearchTodoResult {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
}

export type UserRole = "admin" | "user";

export interface AppUser {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface UserCreateData {
  username: string;
  password: string;
  role: UserRole;
}

export interface UserUpdateData {
  role?: UserRole;
  password?: string;
}

export interface OfflineDevice {
  id: string;
  name: string;
  ip_address: string;
}

export interface BlastRadiusSwitchRef {
  id: string;
  name: string;
}

export interface BlastRadiusInventoryRef {
  id: string;
  name: string;
  type: string;
  status: string;
  switchId: string;
  switchName: string;
}

export interface BlastRadiusResult {
  targetId: string;
  hasBackbone: boolean;
  isBackboneTarget: boolean;
  remainingBackboneCount: number;
  targetWasReachable: boolean;
  affectedSwitchIds: string[];
  critical: boolean;
  affectedSwitches: BlastRadiusSwitchRef[];
  affectedInventory: BlastRadiusInventoryRef[];
}

export interface PingCheckResult {
  checkedAt: string;
  total: number;
  online: number;
  offline: number;
  offlineDevices: OfflineDevice[];
  offlineSwitches: OfflineDevice[];
}

export interface SnmpInterfaceStatus {
  index: number;
  name: string;
  operStatus: string;
}

export interface DiscoveredDevice {
  ip: string;
  sysName: string;
  sysDescr: string;
  ifNumber: number;
}

export interface SnmpDiscoverResult {
  scanned: number;
  found: DiscoveredDevice[];
}

export interface SnmpQueryResult {
  sysName: string;
  sysDescr: string;
  sysUpTime: { ticks: number; formatted: string };
  ifNumber: number;
  interfaces: SnmpInterfaceStatus[];
}

export type VaultCredentialTargetType = "switch" | "inventory" | "other";

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
  locked: boolean;
  lockedUntil: string | null;
}

export interface VaultCredentialSummary {
  id: string;
  target_type: VaultCredentialTargetType;
  target_id: string | null;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface VaultCredentialInput {
  target_type: VaultCredentialTargetType;
  target_id: string | null;
  label: string;
  username: string;
  password: string;
  notes?: string | null;
}

export interface RevealedVaultCredential {
  id: string;
  label: string;
  username: string;
  password: string;
  notes: string | null;
}

export interface License {
  id: string;
  product_name: string;
  vendor: string | null;
  total_seats: number;
  used_seats: number;
  purchase_date: string | null;
  start_date: string | null;
  renewal_date: string | null;
  cost: number | null;
  currency: string;
  /** Şifreli anahtar mevcut mu — anahtarın kendisi ASLA bu tipte taşınmaz. */
  has_key: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LicenseFormData {
  product_name: string;
  vendor: string | null;
  total_seats: number;
  purchase_date: string | null;
  start_date: string | null;
  renewal_date: string | null;
  cost: number | null;
  currency: string;
  notes: string | null;
  /** undefined = mevcut anahtar korunur, "" = anahtar kaldırılır, dolu string = (kasa açık olmalı) yeniden şifrelenir. */
  license_key?: string;
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

export interface LicenseAssignmentInput {
  target_type: LicenseAssignmentTargetType;
  target_id: string | null;
  assigned_label: string;
  notes?: string | null;
}

export interface RevealedLicenseKey {
  id: string;
  license_key: string;
}

export interface SearchResults {
  switches: SearchSwitchResult[];
  inventory: SearchInventoryResult[];
  ip_assignments: SearchIpAssignmentResult[];
  notes: SearchNoteResult[];
  todos: SearchTodoResult[];
}
