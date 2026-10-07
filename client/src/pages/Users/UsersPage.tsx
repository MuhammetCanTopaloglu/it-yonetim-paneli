import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { createUser, deleteUser, listUsers, updateUser } from "../../api/users";
import type { AppUser, UserRole } from "../../types";
import Modal from "../../components/Modal";

const inputClass =
  "w-full rounded-md border bg-surface px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const labelClass = "block text-xs font-medium text-secondary mb-1";

function AddUserForm({ onSubmit, onCancel }: { onSubmit: (data: { username: string; password: string; role: UserRole }) => Promise<void>; onCancel: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ username, password, role });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}

      <div>
        <label className={labelClass}>Kullanıcı adı *</label>
        <input className={inputClass} required autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>

      <div>
        <label className={labelClass}>Şifre * (en az 8 karakter)</label>
        <input
          className={inputClass}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Rol</label>
        <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="user">Normal Kullanıcı</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary">
          Vazgeç
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "Ekleniyor..." : "Ekle"}
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ onSubmit, onCancel }: { onSubmit: (password: string) => Promise<void>; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2">{error}</p>}
      <div>
        <label className={labelClass}>Yeni şifre * (en az 8 karakter)</label>
        <input
          className={inputClass}
          type="password"
          required
          autoFocus
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary">
          Vazgeç
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "Kaydediliyor..." : "Şifreyi Sıfırla"}
        </button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AppUser | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | undefined>(undefined);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Backend zaten 403 döner, ama normal kullanıcı URL'e doğrudan giderse
  // burada da yönlendirilip boş/yetkisiz bir ekranda takılı kalmasın.
  if (currentUser && currentUser.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const adminCount = users.filter((u) => u.role === "admin").length;

  async function handleAdd(data: { username: string; password: string; role: UserRole }) {
    await createUser(data);
    setAddOpen(false);
    await load();
  }

  async function handleRoleChange(target: AppUser, role: UserRole) {
    setActionError(null);
    try {
      await updateUser(target.id, { role });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Rol değiştirilemedi");
    }
  }

  async function handleResetPassword(password: string) {
    if (!resetTarget) return;
    await updateUser(resetTarget.id, { password });
    setResetTarget(undefined);
    await load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteUser(deleteTarget.id);
      setDeleteTarget(undefined);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Kullanıcı silinemedi");
      setDeleteTarget(undefined);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Kullanıcı Yönetimi</h2>
        <button
          onClick={() => setAddOpen(true)}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover"
        >
          + Yeni Kullanıcı
        </button>
      </div>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      {actionError && <p className="text-sm text-danger bg-danger-soft rounded-md px-3 py-2 mb-3">{actionError}</p>}
      {loading && <p className="text-sm text-tertiary">Yükleniyor...</p>}

      {!loading && (
        <div className="rounded-lg border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-surface-secondary text-left text-xs text-secondary">
                <th className="px-4 py-2 font-medium">Kullanıcı adı</th>
                <th className="px-4 py-2 font-medium">Rol</th>
                <th className="px-4 py-2 font-medium">Oluşturulma</th>
                <th className="px-4 py-2 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isLastAdmin = u.role === "admin" && adminCount <= 1;
                const roleLocked = isSelf || isLastAdmin;

                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      {u.username}
                      {isSelf && <span className="ml-2 text-xs text-tertiary">(siz)</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        className="rounded-md border bg-surface px-2 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        value={u.role}
                        disabled={roleLocked}
                        title={
                          isSelf
                            ? "Kendi rolünüzü değiştiremezsiniz"
                            : isLastAdmin
                              ? "Sistemde en az bir admin olmalı"
                              : undefined
                        }
                        onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                      >
                        <option value="user">Normal Kullanıcı</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-secondary">
                      {new Date(u.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-3 text-xs">
                        <button onClick={() => setResetTarget(u)} className="text-accent hover:underline">
                          Şifre Sıfırla
                        </button>
                        <button
                          onClick={() => setDeleteTarget(u)}
                          disabled={isSelf || (u.role === "admin" && isLastAdmin)}
                          title={
                            isSelf
                              ? "Kendi hesabınızı silemezsiniz"
                              : isLastAdmin
                                ? "Sistemde en az bir admin olmalı"
                                : undefined
                          }
                          className="text-danger hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <Modal title="Yeni Kullanıcı" onClose={() => setAddOpen(false)}>
          <AddUserForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} />
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`"${resetTarget.username}" Şifresini Sıfırla`} onClose={() => setResetTarget(undefined)}>
          <ResetPasswordForm onSubmit={handleResetPassword} onCancel={() => setResetTarget(undefined)} />
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Silme Onayı" onClose={() => setDeleteTarget(undefined)}>
          <p className="text-sm mb-4">
            <strong>{deleteTarget.username}</strong> kullanıcısını silmek istediğinize emin misiniz?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeleteTarget(undefined)}
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-surface-secondary"
            >
              Vazgeç
            </button>
            <button onClick={handleDelete} className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:brightness-90">
              Sil
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
