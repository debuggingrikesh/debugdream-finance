import { useEffect } from 'react'
import { useClients, useReminders } from './useFirestore'
import { getTodayBoth, todayString } from '../utils/dateUtils'

export function useInvoiceReminders() {
  const { data: clients, loading: clientsLoading } = useClients()
  const { allData: reminders, loading: remindersLoading, add } = useReminders()
  
  useEffect(() => {
    if (clientsLoading || remindersLoading || !clients.length) return
    
    const { ad, bs } = getTodayBoth()
    const todayStr = todayString()
    
    // Identify recurring clients with reminders enabled
    const eligible = clients.filter(c => c.recurring && c.reminderEnabled && c.reminderDay)
    
    eligible.forEach(async (client) => {
      // Determine if today is the reminder day for this client
      const isNPR = client.currency === 'NPR'
      const match = isNPR 
        ? bs.day === client.reminderDay 
        : ad.getDate() === client.reminderDay
        
      if (match) {
        // Build a period key to ensure we only create one reminder per client per billing month
        const periodKey = isNPR 
          ? `invoice_${client.id}_bs_${bs.year}_${bs.month}`
          : `invoice_${client.id}_ad_${ad.getFullYear()}_${ad.getMonth() + 1}`
          
        const alreadyExists = reminders.find(r => r.periodKey === periodKey)
        
        if (!alreadyExists) {
          try {
            await add({
              title: `Send Invoice: ${client.name}`,
              amount: client.recurringAmount || 0,
              currency: client.currency || 'NPR',
              dueDate: todayStr,
              status: 'active',
              type: 'invoice_reminder',
              periodKey: periodKey,
              clientId: client.id,
              notes: `Monthly recurring invoice for ${client.name}`
            })
            console.log(`[Auto] Reminder created for ${client.name}`)
          } catch (err) {
            console.error('Failed to create automated reminder', err)
          }
        }
      }
    })
  }, [clients, reminders, clientsLoading, remindersLoading, add])
}
