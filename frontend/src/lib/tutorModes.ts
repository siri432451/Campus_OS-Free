export interface TutorModeConfig {
  value: string
  icon: string
  label: string
  description: string
  color: string
}
export const TUTOR_MODES: TutorModeConfig[] = [
  {
    value: 'ANATOMY_PHYSIOLOGY',
    icon: '📚',
    label: 'Anatomy & Physiology',
    description: 'Body systems, structures, and functions',
    color: '#E74C3C',
  },
  {
    value: 'PHARMACOLOGY',
    icon: '💊',
    label: 'Pharmacology Coach',
    description: 'Drug mechanisms, classifications, nursing implications',
    color: '#2E86DE',
  },
  {
    value: 'MEDICAL_SURGICAL',
    icon: '🏥',
    label: 'Medical-Surgical Nursing',
    description: 'Care of patients across all body systems, pre/post-op',
    color: '#C0392B',
  },
  {
    value: 'FOUNDATION_NURSING',
    icon: '🛏️',
    label: 'Foundation of Nursing',
    description: 'Vital signs, basic procedures, fundamentals & OSCE skills',
    color: '#2980B9',
  },
  {
    value: 'CLINICAL_REASONING',
    icon: '🩺',
    label: 'Clinical Reasoning',
    description: 'Patient assessment, nursing diagnoses, care planning',
    color: '#27AE60',
  },
  {
    value: 'MATERNAL_NEWBORN',
    icon: '🤰',
    label: 'Maternal & Newborn',
    description: 'Antenatal, labour, postnatal, newborn care',
    color: '#E67E22',
  },
  {
    value: 'MIDWIFERY',
    icon: '👶',
    label: 'Midwifery Practice',
    description: 'Midwifery skills, labour management, family planning',
    color: '#D35400',
  },
  {
    value: 'MENTAL_HEALTH',
    icon: '🧠',
    label: 'Mental Health Nursing',
    description: 'Psychiatric disorders, therapeutic communication, psychotropics',
    color: '#9B59B6',
  },
  {
    value: 'MICROBIOLOGY_IPC',
    icon: '🌡️',
    label: 'Microbiology & IPC',
    description: 'Pathogens, transmission, infection prevention',
    color: '#8E44AD',
  },
  {
    value: 'COMMUNITY_HEALTH',
    icon: '🏘️',
    label: 'Community Health',
    description: 'Primary healthcare, health promotion, PHC',
    color: '#16A085',
  },
  {
    value: 'NUTRITION_DIETETICS',
    icon: '🥗',
    label: 'Nutrition & Dietetics',
    description: 'Nutrients, therapeutic diets, malnutrition, patient teaching',
    color: '#1ABC9C',
  },
  {
    value: 'ETHICS_JURISPRUDENCE',
    icon: '⚖️',
    label: 'Ethics & Jurisprudence',
    description: 'Ethical principles, NMCN regulation, law & professional conduct',
    color: '#34495E',
  },
  {
    value: 'GENERAL_NURSING',
    icon: '💬',
    label: 'General Nursing Q&A',
    description: 'Broad nursing questions, exam prep, career guidance',
    color: '#122400',
  },
]
export function getModeConfig(value: string): TutorModeConfig {
  return TUTOR_MODES.find(m => m.value === value) ?? TUTOR_MODES[TUTOR_MODES.length - 1]
}
