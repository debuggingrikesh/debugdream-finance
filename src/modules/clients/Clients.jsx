import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, Users, Building2 } from 'lucide-react'
import { useClients } from '../../hooks/useFirestore'
import { addDocument, updateDocument, deleteDocument } from '../../firebase/firestore'
import {
  Card, SectionHeader, Button, Modal, Input, Select,
  ConfirmDialog, EmptyState,
} from '../../components/ui/index'
import clsx from 'clsx'

function clientForm() {
  return {
    name: '',
    currency: 'NPR',
    address: '',
    contactPerson: '',
    reminderEnabled: false,
    reminderDay: 1,
    notes: '',
  }
}

export default function Clients() {
  const { data: clients, loading } = useClients()

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(clientForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [clients]
  )

  const openAdd = () => {
    setEditId(null)
    setForm(clientForm())
    setShowForm(true)
  }

  const openEdit = (client) => {
    setEditId(client.id)
    setForm({
      name: client.name || '',
      currency: client.currency || 'NPR',
      address: client.address || '',
      contactPerson: client.contactPerson || '',
      email: client.email || '',
      recurring: client.recurring || false,
      recurringAmount: client.recurringAmount || '',
      reminderEnabled: client.reminderEnabled || false,
      reminderDay: client.reminderDay || 1,
      notes: client.notes || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const data = {
      ...form,
      recurringAmount: parseFloat(form.recurringAmount) || 0,
    }
    try {
      if (editId) {
        await updateDocument('clients', editId, data)
      } else {
        await addDocument('clients', data)
      }
      setShowForm(false)
      setEditId(null)
      setForm(clientForm())
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteDocument('clients', deleteId)
    setDeleteId(null)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        title="Clients"
        subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        action={<Button size="sm" onClick={openAdd} icon={Plus}>Add Client</Button>}
      />

      {/* Client list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-bg-surface rounded-xl animate-pulse" />)}
        </div>
      ) : sortedClients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clients yet"
          description="Add your first client to use in invoices and income tracking."
          action={<Button onClick={openAdd} icon={Plus}>Add Client</Button>}
        />
      ) : (
        <div className="space-y-2">
          {sortedClients.map(client => (
            <Card key={client.id} className="p-4" hover>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-bg-elevated flex items-center justify-center text-sm font-display font-bold text-text-primary shrink-0">
                    {client.name?.[0] || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-text-primary text-sm">{client.name}</span>
                      <span className="text-[10px] text-text-muted border border-border px-1.5 py-0.5 rounded-md font-mono">{client.currency}</span>
                      {client.recurring && (
                        <span className="text-[10px] text-accent border border-accent/20 px-1.5 py-0.5 rounded-md">Recurring</span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted font-body mt-0.5 truncate">
                      {[client.contactPerson, client.address, client.email].filter(Boolean).join(' · ') || 'No details added'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(client)}
                    className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteId(client.id)}
                    className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Client Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditId(null); setForm(clientForm()) }}
        title={editId ? 'Edit Client' : 'Add Client'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Client Name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. VXL Technologies"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Default Currency" value={form.currency} onChange={e => set('currency', e.target.value)}>
              <option value="NPR">NPR — Nepali Rupee</option>
              <option value="AUD">AUD — Australian Dollar</option>
              <option value="USD">USD — US Dollar</option>
            </Select>
            <Input
              label="Contact Person"
              value={form.contactPerson}
              onChange={e => set('contactPerson', e.target.value)}
              placeholder="e.g. John Doe"
            />
          </div>

          <Input
            label="Email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="client@example.com"
          />

          <Input
            label="Address"
            value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="Client's billing address"
          />

          <div className="p-3 bg-bg-elevated border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-secondary font-body font-medium uppercase tracking-wider">Recurring Client</label>
              <button
                onClick={() => set('recurring', !form.recurring)}
                className={clsx(
                  'w-9 h-5 rounded-full transition-colors relative',
                  form.recurring ? 'bg-accent' : 'bg-border'
                )}
              >
                <div className={clsx(
                  'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                  form.recurring ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </button>
            </div>
            {form.recurring && (
              <div className="space-y-3 pt-2">
                <Input
                  label="Recurring Amount"
                  type="number"
                  value={form.recurringAmount}
                  onChange={e => set('recurringAmount', e.target.value)}
                  placeholder="Monthly recurring amount"
                />

                <div className="grid grid-cols-1 gap-2 pt-1">
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <div>
                      <div className="text-xs text-text-primary font-medium">Invoice Reminder</div>
                      <div className="text-[10px] text-text-muted">Auto-create reminder on day {form.reminderDay}</div>
                    </div>
                    <button
                      onClick={() => set('reminderEnabled', !form.reminderEnabled)}
                      className={clsx(
                        'w-9 h-5 rounded-full transition-colors relative',
                        form.reminderEnabled ? 'bg-green-500' : 'bg-border'
                      )}
                    >
                      <div className={clsx(
                        'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                        form.reminderEnabled ? 'translate-x-4' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>
                  {form.reminderEnabled && (
                    <div className="animate-in slide-in-from-top-1 duration-200">
                      <Input
                        label={form.currency === 'NPR' ? 'Reminder Day (BS Calendar)' : 'Reminder Day (AD Calendar)'}
                        type="number"
                        min={1}
                        max={32}
                        value={form.reminderDay}
                        onChange={e => set('reminderDay', Math.max(1, Math.min(32, parseInt(e.target.value) || 1)))}
                        placeholder="1-31"
                        prefix="Day"
                      />
                      <p className="text-[9px] text-text-muted mt-1 leading-relaxed">
                        {form.currency === 'NPR' 
                          ? "This will track the Nepali Bikram Sambat day. (Baisakh 1, etc.)"
                          : "This will track the standard English calendar day."
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any additional notes..."
          />
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Client"
        message="This will permanently remove this client. Existing invoices and income entries referencing this client will NOT be deleted."
        confirmLabel="Delete"
      />
    </div>
  )
}
