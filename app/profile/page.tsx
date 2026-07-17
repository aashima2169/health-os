// app/profile/page.tsx
// Static, rarely-changing facts about the person — not asked at check-in.
// Not in the bottom nav (same precedent as /periods, /weekly-photos,
// /blood-reports); reached via a link on Settings.
'use client'

import { useEffect, useState } from 'react'
import {
  getProfile, upsertProfile, getConditions, addCondition, deleteCondition,
  getAllMedications, upsertMedication, deleteMedication,
} from '../../lib/db'
import DemographicsSection from '../../components/profile/DemographicsSection'
import ConditionsSection from '../../components/profile/ConditionsSection'
import MedicationsSection from '../../components/profile/MedicationsSection'
import type { Gender, MenstruatingStatus, ProfileCondition, Medication } from '../../types'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [gender, setGender] = useState<Gender | null>(null)
  const [age, setAge] = useState<number | ''>('')
  const [city, setCity] = useState('')
  const [menstruatingStatus, setMenstruatingStatus] = useState<MenstruatingStatus | null>(null)

  const [conditions, setConditions] = useState<ProfileCondition[]>([])
  const [medications, setMedications] = useState<Medication[]>([])

  useEffect(() => {
    Promise.all([getProfile(), getConditions(), getAllMedications()]).then(([profile, cond, meds]) => {
      if (profile) {
        setGender(profile.gender)
        setAge(profile.age ?? '')
        setCity(profile.city ?? '')
        setMenstruatingStatus(profile.menstruating_status)
      }
      setConditions(cond)
      setMedications(meds)
      setLoading(false)
    })
  }, [])

  const handleSaveDemographics = async () => {
    setSaving(true)
    try {
      await upsertProfile({
        gender,
        age: age === '' ? null : age,
        city: city.trim() || null,
        menstruating_status: gender === 'female' ? menstruatingStatus : null,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAddCondition = async (payload: { condition_name: string; diagnosed_date: string | null; notes: string | null }) => {
    const { data } = await addCondition(payload)
    if (data) setConditions((prev) => [data, ...prev])
  }

  const handleDeleteCondition = async (id: string) => {
    await deleteCondition(id)
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }

  const handleAddMedication = async (payload: {
    name: string
    dosage: string | null
    frequency: string | null
    start_date: string | null
    end_date: string | null
    prescription_url: string | null
  }) => {
    const { data } = await upsertMedication(payload)
    if (data) {
      setMedications((prev) => [data, ...prev].sort((a, b) => b.start_date.localeCompare(a.start_date)))
    }
  }

  const handleDeleteMedication = async (id: string) => {
    await deleteMedication(id)
    setMedications((prev) => prev.filter((m) => m.id !== id))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] pb-28">
      <div className="px-5 pt-10 pb-6">
        <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-1">
          Your Profile
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Static Details</h1>
        <p className="text-sm text-slate-400 mt-1">
          Facts that don&apos;t change day to day, but help us understand your data better.
        </p>
      </div>

      <div className="px-4 space-y-4">
        <DemographicsSection
          gender={gender}
          age={age}
          city={city}
          menstruatingStatus={menstruatingStatus}
          saving={saving}
          onGenderChange={setGender}
          onAgeChange={setAge}
          onCityChange={setCity}
          onMenstruatingStatusChange={setMenstruatingStatus}
          onSave={handleSaveDemographics}
        />

        <ConditionsSection
          conditions={conditions}
          onAdd={handleAddCondition}
          onDelete={handleDeleteCondition}
        />

        <MedicationsSection
          medications={medications}
          onAdd={handleAddMedication}
          onDelete={handleDeleteMedication}
        />
      </div>
    </div>
  )
}
