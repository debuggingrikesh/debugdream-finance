import { useState, useMemo } from 'react'
import { Package, Plus, Pencil, Trash2 } from 'lucide-react'
import { useInventory } from '../../hooks/useFirestore'
import { formatNPR } from '../../utils/formatUtils'
import { adToBS, todayString } from '../../utils/dateUtils'
import { Card, SectionHeader, Button, Modal, Input, Select, Badge, Table, EmptyState, ConfirmDialog } from '../../components/ui/index'
import clsx from 'clsx'

const CONDITION_CONFIG = { Good: 'success', Fair: 'warning', 'Needs Repair': 'danger', Disposed: 'default' }
const DEFAULT_CATEGORIES = ['Electronics', 'Furniture', 'Software', 'Stationery', 'Other']

function emptyItem() {
  return { name: '', category: 'Electronics', quantity: 1, purchaseDate: todayString(), purchaseValue: '', condition: 'Good', notes: '' }
}

export default function Inventory() {
  const { data: items, loading, add, update, remove } = useInventory()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyItem())
  const [deleteId, setDeleteId] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterCond, setFilterCond] = useState('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filtered = useMemo(() => items
    .filter(i => filterCat === 'all' || i.category === filterCat)
    .filter(i => filterCond === 'all' || i.condition === filterCond)
    .filter(i => !search || i.name?.toLowerCase().includes(search.toLowerCase())),
    [items, filterCat, filterCond, search]
  )

  const totalValue = items.reduce((s, i) => s + ((i.purchaseValue || 0) * (i.quantity || 1)), 0)

  const handleSave = async () => {
    setSaving(true)
    const bs = adToBS(new Date(form.purchaseDate + 'T00:00:00'))
    const data = { ...form, purchaseValue: parseFloat(form.purchaseValue) || 0, quantity: parseInt(form.quantity) || 1, bsYear: bs.year, bsMonth: bs.month }
    try {
      if (editId) await update(editId, data)
      else await add(data)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (item) => { setEditId(item.id); setForm({ ...item }); setShowForm(true) }
  const openAdd = () => { setEditId(null); setForm(emptyItem()); setShowForm(true) }

  const columns = [
    { header: 'Item', render: (r) => <div><div className="text-text-primary text-sm font-body">{r.name}</div><div className="text-text-muted text-xs">{r.category}</div></div> },
    { header: 'Qty', align: 'center', render: (r) => <span className="font-mono text-text-primary text-sm">{r.quantity}</span> },
    { header: 'Purchase Date', render: (r) => <span className="text-text-secondary text-sm">{r.purchaseDate}</span> },
    { header: 'Value', align: 'right', render: (r) => <span className="font-mono text-text-primary text-sm">{formatNPR(r.purchaseValue)}</span> },
    { header: 'Condition', render: (r) => <Badge variant={CONDITION_CONFIG[r.condition] || 'default'}>{r.condition}</Badge> },
    { header: '', render: (r) => (
      <div className="flex gap-1">
        <button onClick={e => { e.stopPropagation(); openEdit(r) }} className="w-7 h-7 rounded-lg hover:bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"><Pencil size={12} /></button>
        <button onClick={e => { e.stopPropagation(); setDeleteId(r.id) }} className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-text-muted hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Inventory" subtitle={`${items.length} items · Total value: ${formatNPR(totalValue)}`}
        action={<Button size="sm" onClick={openAdd} icon={Plus}>Add Item</Button>} />

      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
          className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-body outline-none focus:border-accent w-48" />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-body outline-none focus:border-accent">
          <option value="all">All categories</option>
          {DEFAULT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterCond} onChange={e => setFilterCond(e.target.value)} className="bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-body outline-none focus:border-accent">
          <option value="all">All conditions</option>
          {['Good', 'Fair', 'Needs Repair', 'Disposed'].map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <Card className="p-5">
        {filtered.length === 0 ? (
          <EmptyState icon={Package} title="No inventory items" description="Track all office assets and equipment here." action={<Button onClick={openAdd} icon={Plus}>Add Item</Button>} />
        ) : (
          <Table columns={columns} data={filtered} loading={loading} />
        )}
      </Card>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Edit Item' : 'Add Item'} size="md"
        footer={<><Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>Save</Button></>}>
        <div className="space-y-4">
          <Input label="Item Name" value={form.name} onChange={e => set('name', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => set('category', e.target.value)}>
              {DEFAULT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </Select>
            <Input label="Quantity" type="number" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Purchase Date" type="date" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)} />
            <Input label="Purchase Value (NPR)" type="number" prefix="NPR" value={form.purchaseValue} onChange={e => set('purchaseValue', e.target.value)} />
          </div>
          <Select label="Condition" value={form.condition} onChange={e => set('condition', e.target.value)}>
            {['Good', 'Fair', 'Needs Repair', 'Disposed'].map(c => <option key={c}>{c}</option>)}
          </Select>
          <Input label="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { await remove(deleteId); setDeleteId(null) }}
        title="Delete Item" message="This will permanently remove this inventory item." confirmLabel="Delete" />
    </div>
  )
}
