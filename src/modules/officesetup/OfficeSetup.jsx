import { useState, useMemo } from 'react'
import { Building2, Plus, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { useOfficeSetup } from '../../hooks/useFirestore'
import { addDocument } from '../../firebase/firestore'
import { formatNPR } from '../../utils/formatUtils'
import { adToBS, todayString } from '../../utils/dateUtils'
import { Card, SectionHeader, Button, Modal, Input, Textarea, EmptyState } from '../../components/ui/index'
import clsx from 'clsx'

export default function OfficeSetup() {
  const { projects, transactions, loading } = useOfficeSetup()
  const [showProject, setShowProject] = useState(false)
  const [showTx, setShowTx] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [projectForm, setProjectForm] = useState({ name: '', description: '', startDate: todayString() })
  const [txForm, setTxForm] = useState({ date: todayString(), description: '', amount: '', paymentSource: 'bank', receiptNote: '' })
  const [saving, setSaving] = useState(false)

  const grandTotal = transactions.reduce((s, t) => s + (t.amount || 0), 0)

  const projectTotal = (projectId) => transactions.filter(t => t.projectId === projectId).reduce((s, t) => s + (t.amount || 0), 0)
  const projectTxs = (projectId) => transactions.filter(t => t.projectId === projectId).sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  const handleSaveProject = async () => {
    setSaving(true)
    try {
      await addDocument('officeSetup', { ...projectForm, total: 0 })
      setShowProject(false)
      setProjectForm({ name: '', description: '', startDate: todayString() })
    } finally { setSaving(false) }
  }

  const handleSaveTx = async () => {
    if (!selectedProject || !txForm.amount) return
    setSaving(true)
    const bs = adToBS(new Date(txForm.date + 'T00:00:00'))
    try {
      await addDocument('officeSetupTransactions', {
        ...txForm,
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        amount: parseFloat(txForm.amount) || 0,
        bsYear: bs.year,
        bsMonth: bs.month,
      })
      setShowTx(false)
      setTxForm({ date: todayString(), description: '', amount: '', paymentSource: 'bank', receiptNote: '' })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader title="Office Setup" subtitle={`${projects.length} projects · Grand total: ${formatNPR(grandTotal)}`}
        action={<Button size="sm" onClick={() => setShowProject(true)} icon={Plus}>New Project</Button>} />

      {projects.length === 0 ? (
        <EmptyState icon={Building2} title="No setup projects" description="Group one-time capital purchases under named projects." action={<Button onClick={() => setShowProject(true)} icon={Plus}>New Project</Button>} />
      ) : (
        <div className="space-y-3">
          {projects.map(proj => {
            const total = projectTotal(proj.id)
            const txs = projectTxs(proj.id)
            const isExpanded = expanded[proj.id]
            return (
              <Card key={proj.id} className="overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-[#161616] transition-colors"
                  onClick={() => setExpanded(e => ({ ...e, [proj.id]: !e[proj.id] }))}>
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={16} className="text-[#555]" /> : <ChevronRight size={16} className="text-[#555]" />}
                    <div>
                      <div className="font-display font-bold text-white">{proj.name}</div>
                      <div className="text-xs text-[#444] font-body">{proj.description} · Started {proj.startDate}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono text-white font-bold">{formatNPR(total)}</div>
                      <div className="text-xs text-[#444]">{txs.length} transactions</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedProject(proj); setShowTx(true) }}
                      className="text-xs text-[#555] hover:text-white border border-[#2a2a2a] hover:border-[#444] px-2.5 py-1.5 rounded-lg font-body transition-all flex items-center gap-1"
                    >
                      <Plus size={11} /> Add
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-[#2a2a2a] bg-[#0d0d0d]">
                    {txs.length === 0 ? (
                      <p className="text-center text-[#333] text-sm font-body py-4">No transactions yet</p>
                    ) : txs.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a] last:border-0">
                        <div>
                          <div className="text-sm text-white font-body">{tx.description}</div>
                          <div className="text-xs text-[#444]">{tx.date} · {tx.paymentSource}</div>
                        </div>
                        <span className="font-mono text-white text-sm">{formatNPR(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal isOpen={showProject} onClose={() => setShowProject(false)} title="New Setup Project" size="sm"
        footer={<><Button variant="ghost" onClick={() => setShowProject(false)}>Cancel</Button><Button onClick={handleSaveProject} loading={saving}>Create</Button></>}>
        <div className="space-y-4">
          <Input label="Project Name" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Office Setup 2082" />
          <Input label="Description" value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} />
          <Input label="Start Date" type="date" value={projectForm.startDate} onChange={e => setProjectForm(f => ({ ...f, startDate: e.target.value }))} />
        </div>
      </Modal>

      <Modal isOpen={showTx} onClose={() => setShowTx(false)} title={`Add Transaction · ${selectedProject?.name}`} size="sm"
        footer={<><Button variant="ghost" onClick={() => setShowTx(false)}>Cancel</Button><Button onClick={handleSaveTx} loading={saving} disabled={!txForm.amount}>Save</Button></>}>
        <div className="space-y-4">
          <Input label="Date" type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} />
          <Input label="Description" value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} />
          <Input label="Amount (NPR)" type="number" prefix="NPR" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} />
          <div>
            <label className="text-xs text-[#888] font-body font-medium uppercase tracking-wider block mb-2">Payment Source</label>
            <div className="flex gap-2">
              {['bank', 'cash'].map(s => (
                <button key={s} onClick={() => setTxForm(f => ({ ...f, paymentSource: s }))}
                  className={clsx('flex-1 py-2 rounded-lg text-sm font-body border capitalize transition-all',
                    txForm.paymentSource === s ? 'bg-[#E8192C]/10 border-[#E8192C] text-[#E8192C]' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#555]'
                  )}>
                  {s === 'bank' ? '🏦 Bank' : '💵 Cash'}
                </button>
              ))}
            </div>
          </div>
          <Input label="Receipt Note" value={txForm.receiptNote} onChange={e => setTxForm(f => ({ ...f, receiptNote: e.target.value }))} />
        </div>
      </Modal>
    </div>
  )
}
