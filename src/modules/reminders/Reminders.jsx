import { useState, useMemo } from 'react'
import { Bell, Plus, CheckCircle, Clock, Trash2 } from 'lucide-react'
import { useReminders } from '../../hooks/useFirestore'
import { formatNPR } from '../../utils/formatUtils'
import { todayString } from '../../utils/dateUtils'
import { Card, SectionHeader, Button, Modal, Input, Badge, EmptyState, ConfirmDialog } from '../../components/ui/index'
import clsx from 'clsx'

export default function Reminders() {
  const { data: active, allData: all, loading, add, update, remove } = useReminders()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', amount: '', dueDate: '', notes: '' })
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('active')

  const displayed = tab === 'active'
    ? all.filter(r => r.status !== 'done')
    : all.filter(r => r.status === 'done')

  const handleAdd = async () => {
    setSaving(true)
    try {
      await add({ ...form, amount: parseFloat(form.amount) || 0, status: 'active', type: 'manual' })
      setShowAdd(false)
      setForm({ title: '', amount: '', dueDate: '', notes: '' })
    } finally { setSaving(false) }
  }

  const markDone = async (r) => {
    await update(r.id, { status: 'done', doneAt: todayString() })
  }

  const isOverdue = (r) => r.dueDate && new Date(r.dueDate) < new Date()

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Reminders" subtitle={`${active.length} active alerts`}
        action={<Button size="sm" onClick={() => setShowAdd(true)} icon={Plus}>Add Reminder</Button>} />

      <div className="flex gap-1 bg-bg-surface border border-border rounded-xl p-1 w-fit">
        {[{ id: 'active', label: 'Active' }, { id: 'done', label: 'Done' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-body transition-all',
              tab === t.id ? 'bg-accent text-text-primary' : 'text-text-muted hover:text-text-primary')}>
            {t.label}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <EmptyState icon={Bell} title={tab === 'active' ? 'No active reminders' : 'No completed reminders'}
          description="Reminders are auto-created for TDS, SSF deposits, and overdue invoices."
          action={tab === 'active' && <Button onClick={() => setShowAdd(true)} icon={Plus}>Add Reminder</Button>} />
      ) : (
        <div className="space-y-2">
          {displayed.map(r => {
            const overdue = isOverdue(r)
            return (
              <Card key={r.id} className={clsx('p-4', overdue && 'border-red-500/30')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      r.status === 'done' ? 'bg-green-500/10 text-green-400' : overdue ? 'bg-red-500/10 text-red-400' : 'bg-bg-elevated text-text-muted')}>
                      {r.status === 'done' ? <CheckCircle size={14} /> : <Clock size={14} />}
                    </div>
                    <div>
                      <div className="font-body font-medium text-text-primary text-sm">{r.title}</div>
                      {r.amount > 0 && <div className="font-mono text-accent text-sm mt-0.5">{formatNPR(r.amount)}</div>}
                      {r.dueDate && (
                        <div className={clsx('text-xs mt-0.5', overdue ? 'text-red-400' : 'text-text-muted')}>
                          {overdue ? '⚠ Overdue · ' : 'Due '}{r.dueDate}
                        </div>
                      )}
                      {r.notes && <div className="text-xs text-text-muted mt-1">{r.notes}</div>}
                      <div className="mt-1">
                        <Badge variant={r.type === 'tds' ? 'warning' : r.type === 'ssf' ? 'info' : 'default'}>
                          {r.type || 'manual'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.status !== 'done' && (
                      <button onClick={() => markDone(r)} className="text-xs text-text-muted hover:text-green-400 border border-border hover:border-green-500/30 px-2.5 py-1.5 rounded-lg font-body transition-all flex items-center gap-1">
                        <CheckCircle size={11} /> Done
                      </button>
                    )}
                    <button onClick={() => setDeleteId(r.id)} className="w-7 h-7 rounded-lg hover:bg-accent/10 flex items-center justify-center text-text-muted hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Reminder" size="sm"
        footer={<><Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd} loading={saving} disabled={!form.title}>Add</Button></>}>
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Pay office rent" />
          <Input label="Amount (NPR, optional)" type="number" prefix="NPR" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          <Input label="Due Date" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          <Input label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)}
        onConfirm={async () => { await remove(deleteId); setDeleteId(null) }}
        title="Delete Reminder" message="Remove this reminder permanently?" confirmLabel="Delete" />
    </div>
  )
}
