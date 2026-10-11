// Standard Basic Nursing (R.N.) curriculum used for transcripts.
// Source: the college's published transcript layout (course codes, titles, hours, credit units).
// No student data or scores live here. Rows are kept exactly as published, including the
// repeated code GNS 310 in Third Year First Semester (flagged for the registry to confirm).

export const BASIC_NURSING = 'BASIC_NURSING'

export interface CurriculumRow {
  year: number
  semester: number
  code: string
  title: string
  lecture: number
  practical: number
  credit: number
}

// [year, semester, code, title, lectureHours, practicalHours, creditUnit]
type T = [number, number, string, string, number, number, number]

const ROWS: T[] = [
  // First year, first semester
  [1, 1, 'GNS 110', 'ANATOMY AND PHYSIOLOGY I', 30, 45, 4],
  [1, 1, 'GNS 111', 'FOUNDATION OF NURSING I', 30, 45, 4],
  [1, 1, 'GNS 112', 'NUTRITION', 15, 45, 2],
  [1, 1, 'GST 110', 'USE OF ENGLISH', 30, 0, 2],
  [1, 1, 'GST 111', 'APPLIED PHYSICS', 15, 45, 2],
  [1, 1, 'GST 112', 'APPLIED CHEMISTRY', 15, 45, 2],
  [1, 1, 'GST 113', 'SOCIOLOGY', 30, 0, 2],
  [1, 1, 'GST 114', 'INTRODUCTION TO INFORMATION COMMUNICATION TECHNOLOGY', 15, 45, 2],
  // First year, second semester
  [1, 2, 'GNS 120', 'ANATOMY AND PHYSIOLOGY II', 45, 45, 4],
  [1, 2, 'GNS 121', 'FOUNDATION OF NURSING II', 30, 45, 4],
  [1, 2, 'GNS 122', 'ADULT MEDICAL NURSING I', 80, 120, 3],
  [1, 2, 'GNS 123', 'ADULT MEDICAL NURSING II (GERIATRIC)', 80, 120, 3],
  [1, 2, 'GNS 124', 'INTRODUCTION TO ENTREPRENEURSHIP', 80, 120, 3],
  [1, 2, 'GNS 125', 'PRIMARY HEALTH CARE I', 30, 45, 3],
  [1, 2, 'GNS 126', 'MICROBIOLOGY', 30, 45, 3],
  [1, 2, 'GNS 127', 'PHARMACOLOGY I', 30, 45, 2],
  [1, 2, 'GST 128', 'PSYCHOLOGY', 30, 45, 2],
  [1, 2, 'GNS 129', 'HOSPITAL BASED CLINICAL PRACTICE I', 0, 180, 4],
  // Second year, first semester
  [2, 1, 'GNS 210', 'ANATOMY AND PHYSIOLOGY III', 45, 30, 3],
  [2, 1, 'GNS 211', 'FOUNDATION OF NURSING III', 30, 45, 3],
  [2, 1, 'GNS 212', 'ADULT SURGICAL NURSING I', 80, 120, 3],
  [2, 1, 'GNS 213', 'PRIMARY HEALTH CARE II', 45, 30, 3],
  [2, 1, 'GNS 214', 'PHARMACOLOGY II', 30, 0, 2],
  [2, 1, 'GNS 215', 'ADULT SURGICAL NURSING II (GERIATRIC)', 80, 120, 3],
  [2, 1, 'GNS 216', 'BIOSTATISTICS', 30, 0, 2],
  [2, 1, 'GNS 217', 'RESEARCH METHODOLOGY I', 30, 0, 2],
  [2, 1, 'GNS 218', 'HOSPITAL BASED CLINICAL PRACTICAL I', 0, 180, 4],
  [2, 1, 'GNS 219', 'COMMUNITY BASED CLINICAL PRACTICAL I', 0, 180, 4],
  // Second year, second semester
  [2, 2, 'GNS 220', 'ANATOMY AND PHYSIOLOGY IV', 30, 0, 3],
  [2, 2, 'GNS 221', 'FOUNDATION OF NURSING IV', 30, 45, 3],
  [2, 2, 'GNS 222', 'MEDICAL SURGICAL NURSING III', 30, 45, 3],
  [2, 2, 'GNS 223', 'PHARMACOLOGY III', 30, 45, 2],
  [2, 2, 'GNS 224', 'RESEARCH METHODOLOGY II', 30, 10, 2],
  [2, 2, 'GNS 225', 'COMMUNITY HEALTH NURSING I', 30, 100, 2],
  [2, 2, 'GNS 226', 'MATERNAL/INFANT (EXCLUDING GYNAECOLOGY)', 80, 120, 3],
  [2, 2, 'GNS 227', 'DIETETICS', 15, 45, 2],
  [2, 2, 'GST 220', 'INTRODUCTION TO MEDICAL SOCIOLOGY', 30, 0, 2],
  [2, 2, 'GNS 228', 'INTRODUCTION TO SEMINAR PRESENTATION/WRITING OF TERM PAPER', 30, 0, 2],
  [2, 2, 'GNS 229', 'HOSPITAL BASED CLINICAL PRACTICAL III', 0, 180, 4],
  // Third year, first semester
  [3, 1, 'GNS 310', 'MEDICAL SURGICAL NURSING IV', 80, 120, 3],
  [3, 1, 'GNS 311', 'RESEARCH PROJECT', 45, 0, 2],
  [3, 1, 'GNS 312', 'NURSING CARE OF CHILDREN (PAEDIATRICS)', 80, 120, 3],
  [3, 1, 'GNS 313', 'COMMUNITY HEALTH CONCEPTS', 80, 120, 3],
  [3, 1, 'GNS 314', 'PSYCHIATRIC NURSING/MENTAL HEALTH (EXCLUDING NEUROLOGY)', 80, 160, 3],
  [3, 1, 'GNS 315', 'EMERGENCY AND DISASTER NURSING', 30, 45, 3],
  [3, 1, 'GNS 310', 'PRINCIPLES OF MANAGEMENT AND TEACHING', 45, 30, 3],
  [3, 1, 'GNS 316', 'SEMINAR IN NURSING', 15, 45, 2],
  [3, 1, 'GST 317', 'HOSPITAL BASED CLINICAL PRACTICE IV', 30, 180, 4],
  [3, 1, 'GNS 318', 'COMMUNITY BASED PRACTICE II', 30, 180, 4],
  // Third year, second semester
  [3, 2, 'GNS 320', 'MEDICAL SURGICAL NURSING V', 80, 120, 3],
  [3, 2, 'GNS 321', 'OBSTETRIC AND GYNAECOLOGICAL NURSING', 80, 120, 4],
  [3, 2, 'GNS 322', 'RESEARCH PROJECT', 30, 45, 2],
  [3, 2, 'GST 320', 'HEALTH ECONOMIC', 30, 0, 2],
  [3, 2, 'GST 321', 'ENTREPRENEURSHIP', 30, 45, 3],
  [3, 2, 'GNS 323', 'HOSPITAL BASED PRACTICE V', 30, 180, 4],
]

export const BASIC_NURSING_CURRICULUM: CurriculumRow[] = ROWS.map(
  ([year, semester, code, title, lecture, practical, credit]) =>
    ({ year, semester, code, title, lecture, practical, credit })
)
