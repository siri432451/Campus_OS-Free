import { useState, useEffect, useRef } from 'react'
import { EXTRA_PROCEDURES } from '../data/procedures'

const API = (import.meta.env.VITE_API_URL as string | undefined) || ''
function authHeaders(): Record<string,string> {
  const t = localStorage.getItem('campusos_token')
  return t ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

const C = {
  navy: "#1B4332", purple: "#122400", gold: "#D4A24C",
  green: "#065F46", red: "#991B1B", bg: "#F5F7FA",
  white: "#FFFFFF", text: "#1B4332", muted: "#8A9BB0", border: "#E8EDF2",
}

const PROCEDURES: any[] = [
  {
    id: "im", title: "IM Injection", icon: "💉", accent: "#991B1B",
    difficulty: "Intermediate", total_marks: 10, xp: 100,
    scenario: {
      setting: "Medical Ward B — OSUN STATE COLLEGE OF NURSING",
      patient: "Mrs Funmi Adeyemi, 34F, Bed 7",
      presenting: "Patient has been prescribed Penicillin 500mg IM by Dr. Okonkwo. The prescription chart is on the patient's folder. Patient is conscious and alert.",
    },
    steps: [
      { id:1, text:"Verify prescription — check patient name, drug, dose, route, time, signature (6 Rights)", section:"PREPARATION", mark:1, critical:true },
      { id:2, text:"Greet patient and introduce yourself", section:"PREPARATION", mark:0.5, critical:false },
      { id:3, text:"Explain procedure to patient and obtain consent", section:"PREPARATION", mark:0.5, critical:true },
      { id:4, text:"Provide privacy — draw curtains", section:"PREPARATION", mark:0.5, critical:false },
      { id:5, text:"Wash and sanitize hands", section:"PREPARATION", mark:0.5, critical:true },
      { id:6, text:"Put on hand gloves", section:"PREPARATION", mark:0.5, critical:true },
      { id:7, text:"Check medication: name, expiry date, appearance, dosage", section:"PROCEDURE", mark:0.5, critical:true },
      { id:8, text:"Draw up medication using aseptic technique", section:"PROCEDURE", mark:0.5, critical:false },
      { id:9, text:"Change needle after drawing up medication", section:"PROCEDURE", mark:0.5, critical:false },
      { id:10, text:"Position patient and expose injection site", section:"PROCEDURE", mark:0.5, critical:false },
      { id:11, text:"Clean injection site with alcohol swab in circular motion — allow to dry 30 seconds", section:"PROCEDURE", mark:0.5, critical:false },
      { id:12, text:"Stretch skin taut using Z-track technique", section:"PROCEDURE", mark:0.5, critical:false },
      { id:13, text:"Insert needle at 90° angle with swift, firm motion", section:"PROCEDURE", mark:1, critical:true },
      { id:14, text:"Aspirate to confirm needle is not in a blood vessel", section:"PROCEDURE", mark:1, critical:true },
      { id:15, text:"Inject medication slowly and steadily", section:"PROCEDURE", mark:0.5, critical:false },
      { id:16, text:"Withdraw needle smoothly at same angle", section:"PROCEDURE", mark:0.5, critical:false },
      { id:17, text:"Apply light pressure with dry swab — do NOT rub", section:"PROCEDURE", mark:0.5, critical:false },
      { id:18, text:"Dispose of needle DIRECTLY into sharps container — do NOT recap", section:"PROCEDURE", mark:1, critical:true },
      { id:19, text:"Remove gloves and wash hands", section:"FINISHING", mark:0.5, critical:false },
      { id:20, text:"Observe patient for adverse reactions for 15-30 minutes", section:"FINISHING", mark:0.5, critical:true },
      { id:21, text:"Document: time, drug, dose, site, nurse signature", section:"FINISHING", mark:0.5, critical:true },
    ],
    distractors: ["Recap the needle before disposal","Inject medication rapidly","Skip aspiration if patient looks well","Use same needle for drawing and injecting","Rub injection site vigorously after","Administer without checking expiry date","Give medication without explaining to patient"],
    quiz_context: "IM injection procedure, medication administration rights, Z-track technique, aspiration, sharps disposal, anaphylaxis recognition, documentation"
  },
  {
    id: "wound", title: "Wound Dressing", icon: "🩹", accent: "#065F46",
    difficulty: "Intermediate", total_marks: 10, xp: 100,
    scenario: {
      setting: "Surgical Ward — Day 3 Post-Op",
      patient: "Mr Chukwuemeka Obi, 52M, Bed 12",
      presenting: "Patient had appendectomy 3 days ago. Wound dressing is due for change. Patient reports mild soreness around wound site.",
    },
    steps: [
      { id:1, text:"Verify prescription and identify patient", section:"PREPARATION", mark:0.5, critical:true },
      { id:2, text:"Ask for assisting nurse", section:"PREPARATION", mark:0.5, critical:false },
      { id:3, text:"Greet patient, introduce self and assisting nurse", section:"PREPARATION", mark:0.5, critical:false },
      { id:4, text:"Explain procedure to patient and obtain consent", section:"PREPARATION", mark:0.5, critical:true },
      { id:5, text:"Provide privacy — draw curtains", section:"PREPARATION", mark:0.5, critical:false },
      { id:6, text:"Wash and sanitize hands", section:"PREPARATION", mark:0.5, critical:true },
      { id:7, text:"Put on hand gloves", section:"PREPARATION", mark:0.5, critical:true },
      { id:8, text:"Place dressing trolley at convenient position near patient bed", section:"PROCEDURE", mark:0.5, critical:false },
      { id:9, text:"Place patient in suitable position", section:"PROCEDURE", mark:0.5, critical:false },
      { id:10, text:"Place dressing mackintosh and towel under area to be dressed", section:"PROCEDURE", mark:0.5, critical:false },
      { id:11, text:"Instruct assisting nurse to loosen and remove outer dressing into biohazard bag", section:"PROCEDURE", mark:0.5, critical:false },
      { id:12, text:"Instruct assisting nurse to pour methylated spirit into gallipot", section:"PROCEDURE", mark:0.5, critical:false },
      { id:13, text:"Remove inner wound dressing with sterile forceps — dispose in biohazard bag", section:"PROCEDURE", mark:0.5, critical:true },
      { id:14, text:"Observe wound for signs of healing and infection (pus, offensive odour)", section:"PROCEDURE", mark:1, critical:true },
      { id:15, text:"Cleanse wound from inside outward with antiseptic swab — one stroke per swab", section:"PROCEDURE", mark:1, critical:true },
      { id:16, text:"Repeat cleansing until wound is clean", section:"PROCEDURE", mark:0.5, critical:false },
      { id:17, text:"Use dry swab to dry the wound", section:"PROCEDURE", mark:0.5, critical:false },
      { id:18, text:"Cover wound with gauze and secure with strapping bandage", section:"PROCEDURE", mark:0.5, critical:false },
      { id:19, text:"Remove mackintosh and towel from under patient", section:"PROCEDURE", mark:0.25, critical:false },
      { id:20, text:"Make patient comfortable", section:"PROCEDURE", mark:0.25, critical:false },
      { id:21, text:"Appreciate patient", section:"FINISHING", mark:0.25, critical:false },
      { id:22, text:"Remove hand gloves", section:"FINISHING", mark:0.25, critical:false },
      { id:23, text:"Wash and sanitize hands", section:"FINISHING", mark:0.5, critical:false },
      { id:24, text:"Document procedure, record and report findings and observations", section:"FINISHING", mark:0.5, critical:true },
    ],
    distractors: ["Clean wound from outside to inside","Use same swab for multiple strokes","Skip observation of wound for infection","Remove inner dressing with bare hands","Leave wound exposed without new dressing","Touch sterile field with non-sterile items"],
    quiz_context: "Wound dressing, aseptic technique, wound assessment, healing types, signs of infection, biohazard waste disposal, documentation"
  },
  {
    id: "vitals", title: "Taking Vital Signs", icon: "📊", accent: "#122400",
    difficulty: "Beginner", total_marks: 10, xp: 60,
    scenario: {
      setting: "General Ward — Morning Observations",
      patient: "Miss Adunola Bello, 22F, Bed 3",
      presenting: "Patient admitted with suspected malaria. Doctor ordered 4-hourly vital signs monitoring. Patient is awake and cooperative.",
    },
    steps: [
      { id:1, text:"Greet patient and introduce yourself", section:"PREPARATION", mark:0.5, critical:false },
      { id:2, text:"Explain procedure and obtain consent", section:"PREPARATION", mark:0.5, critical:false },
      { id:3, text:"Provide privacy", section:"PREPARATION", mark:0.5, critical:false },
      { id:4, text:"Wash and sanitize hands", section:"PREPARATION", mark:0.5, critical:true },
      { id:5, text:"Position patient comfortably — ensure 5 minutes rest", section:"PROCEDURE", mark:0.5, critical:false },
      { id:6, text:"Hold thermometer with mercury bulb outward — shake down below 35°C", section:"PROCEDURE", mark:0.5, critical:true },
      { id:7, text:"Mop patient's armpit with dry swab", section:"PROCEDURE", mark:0.5, critical:false },
      { id:8, text:"Place mercury bulb under mopped armpit and clamp in place", section:"PROCEDURE", mark:0.5, critical:false },
      { id:9, text:"Keep thermometer in place for 3 minutes", section:"PROCEDURE", mark:0.5, critical:true },
      { id:10, text:"Place index, middle, ring fingers over radial artery — count pulse for 60 seconds", section:"PROCEDURE", mark:0.5, critical:true },
      { id:11, text:"Note pulse rate, rhythm, strength and tension", section:"PROCEDURE", mark:0.5, critical:false },
      { id:12, text:"Keep holding wrist — observe respirations without alerting patient for 60 seconds", section:"PROCEDURE", mark:0.5, critical:true },
      { id:13, text:"Release patient's hands", section:"PROCEDURE", mark:0.25, critical:false },
      { id:14, text:"Record pulse and respiration on paper", section:"PROCEDURE", mark:0.5, critical:false },
      { id:15, text:"Remove thermometer from armpit — hold at eye level to read", section:"PROCEDURE", mark:0.5, critical:true },
      { id:16, text:"Record temperature reading", section:"PROCEDURE", mark:0.5, critical:false },
      { id:17, text:"Wash and sanitize hands", section:"FINISHING", mark:0.5, critical:false },
      { id:18, text:"Document all vital signs with date, time and nurse signature", section:"FINISHING", mark:0.5, critical:true },
      { id:19, text:"Report any abnormal findings to senior nurse immediately", section:"FINISHING", mark:0.5, critical:true },
    ],
    distractors: ["Count pulse for 30 seconds and multiply by 2","Alert patient before counting respirations","Read thermometer while still in armpit","Skip documenting vital signs","Count radial pulse with thumb","Ignore abnormal readings"],
    quiz_context: "Vital signs assessment, normal ranges, mercury thermometer use, radial pulse, respiration counting, documentation, escalation of abnormal findings"
  },
  {
    id: "handwash", title: "Hand Washing", icon: "🧼", accent: "#0077B6",
    difficulty: "Beginner", total_marks: 6, xp: 50,
    scenario: {
      setting: "Clinical Ward — Before Patient Contact",
      patient: "General ward patient contact",
      presenting: "You are about to attend to a patient. The examiner is watching your hand hygiene technique using the WHO 6-step method.",
    },
    steps: [
      { id:1, text:"Wet hands with clean running water", section:"PROCEDURE", mark:0.5, critical:true },
      { id:2, text:"Apply enough soap to cover all hand surfaces", section:"PROCEDURE", mark:0.5, critical:false },
      { id:3, text:"Rub palms together (WHO Step 1)", section:"PROCEDURE", mark:0.5, critical:false },
      { id:4, text:"Rub right palm over left dorsum with interlaced fingers — then vice versa (WHO Step 2)", section:"PROCEDURE", mark:0.5, critical:true },
      { id:5, text:"Rub palm to palm with fingers interlaced (WHO Step 3)", section:"PROCEDURE", mark:0.5, critical:false },
      { id:6, text:"Rub backs of fingers to opposing palms with fingers interlocked (WHO Step 4)", section:"PROCEDURE", mark:0.5, critical:false },
      { id:7, text:"Rub right thumb clasped in left palm rotationally — then vice versa (WHO Step 5)", section:"PROCEDURE", mark:0.5, critical:true },
      { id:8, text:"Rub tips of right fingers in left palm rotationally — then vice versa (WHO Step 6)", section:"PROCEDURE", mark:0.5, critical:false },
      { id:9, text:"Rinse hands thoroughly under running water — wrist to fingertips", section:"PROCEDURE", mark:0.5, critical:true },
      { id:10, text:"Dry hands with single-use towel", section:"FINISHING", mark:0.5, critical:false },
      { id:11, text:"Use towel to turn off the tap — avoid re-contaminating hands", section:"FINISHING", mark:0.5, critical:true },
      { id:12, text:"Dispose of towel appropriately", section:"FINISHING", mark:0.5, critical:false },
    ],
    distractors: ["Dry hands before rinsing","Turn off tap with bare clean hands","Skip rinsing between steps","Apply soap without wetting hands first","Rinse from fingertips to wrist","Use shared cloth towel"],
    quiz_context: "WHO 6-step hand hygiene, 5 moments for hand hygiene, alcohol-based hand rub, infection control, standard precautions"
  },
  {
    id: "catheter", title: "Female Catheterization", icon: "🏥", accent: "#1B4332",
    difficulty: "Advanced", total_marks: 10, xp: 150,
    scenario: {
      setting: "Gynaecology Ward",
      patient: "Mrs Blessing Okafor, 42F, Bed 5",
      presenting: "Patient unable to void for 8 hours post-partum with lower abdominal discomfort. Doctor prescribed urethral catheterization.",
    },
    steps: [
      { id:1, text:"Greet client and introduce yourself", section:"PREPARATION", mark:0.5, critical:false },
      { id:2, text:"Explain procedure and obtain informed consent", section:"PREPARATION", mark:0.5, critical:true },
      { id:3, text:"Provide privacy — draw curtains", section:"PREPARATION", mark:0.25, critical:false },
      { id:4, text:"Assist client to dorsal position — knees flexed and abducted", section:"PROCEDURE", mark:0.75, critical:true },
      { id:5, text:"Wash and dry hands thoroughly", section:"PROCEDURE", mark:0.75, critical:true },
      { id:6, text:"Don sterile gloves", section:"PROCEDURE", mark:0.5, critical:true },
      { id:7, text:"Ask assistant to open equipment — place mackintosh under buttocks", section:"PROCEDURE", mark:0.5, critical:false },
      { id:8, text:"Position receiver between the thighs", section:"PROCEDURE", mark:0.25, critical:false },
      { id:9, text:"Swab vestibule, labia minora and labia majora with saline swabs", section:"PROCEDURE", mark:0.75, critical:true },
      { id:10, text:"Lubricate the catheter", section:"PROCEDURE", mark:0.75, critical:false },
      { id:11, text:"Separate labia minora to expose urethral orifice", section:"PROCEDURE", mark:0.5, critical:true },
      { id:12, text:"Introduce catheter gently at 7.5cm from tip until urine obtained", section:"PROCEDURE", mark:0.75, critical:true },
      { id:13, text:"Inflate balloon, connect to urine bag and hang to side of bed", section:"PROCEDURE", mark:0.75, critical:false },
      { id:14, text:"Measure quantity of urine drained", section:"PROCEDURE", mark:0.5, critical:false },
      { id:15, text:"Remove equipment and make client comfortable", section:"FINISHING", mark:0.5, critical:false },
      { id:16, text:"Wash and dry hands", section:"FINISHING", mark:0.5, critical:false },
      { id:17, text:"Appreciate client", section:"FINISHING", mark:0.25, critical:false },
      { id:18, text:"Document intervention — quantity of urine, patient response", section:"FINISHING", mark:0.5, critical:true },
    ],
    distractors: ["Insert catheter without lubricating","Use non-sterile gloves","Skip swabbing perineal area","Position patient with legs flat","Forget to inflate balloon","Leave patient without drainage bag"],
    quiz_context: "Female catheterization, indications, urethral anatomy, Foley catheter, aseptic technique, UTI prevention, urine measurement, dorsal recumbent position"
  },
  {
    id: "bls", title: "BLS / CPR", icon: "❤️", accent: "#B91C1C",
    difficulty: "Advanced", total_marks: 10, xp: 150,
    scenario: {
      setting: "General Ward — Night Rounds",
      patient: "Mr Taiwo Adekoya, 58M",
      presenting: "During night rounds you find Mr Taiwo unresponsive in his bed. He appears pale. You are first to reach him. One other staff member is at the nurses station.",
    },
    steps: [
      { id:1, text:"Check scene safety before approaching patient", section:"PREPARATION", mark:1, critical:true },
      { id:2, text:"Check patient response — tap shoulders firmly, shout 'Are you alright?'", section:"PREPARATION", mark:1, critical:true },
      { id:3, text:"Call for help — shout to nearby staff", section:"PREPARATION", mark:0.5, critical:true },
      { id:4, text:"Call emergency line (112) or send colleague — do NOT leave patient alone", section:"PREPARATION", mark:1, critical:true },
      { id:5, text:"Open airway using head tilt, chin lift", section:"PROCEDURE", mark:0.5, critical:true },
      { id:6, text:"Look, listen, feel for normal breathing — no more than 10 seconds", section:"PROCEDURE", mark:0.5, critical:true },
      { id:7, text:"Request AED if available", section:"PROCEDURE", mark:0.25, critical:false },
      { id:8, text:"Position patient flat on hard surface", section:"PROCEDURE", mark:0.25, critical:false },
      { id:9, text:"Place heel of hand on centre of chest — lower half of sternum", section:"PROCEDURE", mark:0.5, critical:true },
      { id:10, text:"Interlock fingers, straight arms — compress at least 5cm deep with full recoil", section:"PROCEDURE", mark:0.5, critical:true },
      { id:11, text:"Deliver 30 chest compressions at 100-120 per minute", section:"PROCEDURE", mark:1, critical:true },
      { id:12, text:"Reopen airway — head tilt chin lift", section:"PROCEDURE", mark:0.25, critical:false },
      { id:13, text:"Pinch nose, seal lips, give 2 rescue breaths over 1 second each — watch chest rise", section:"PROCEDURE", mark:0.5, critical:true },
      { id:14, text:"Continue 30:2 ratio without interruption", section:"PROCEDURE", mark:1, critical:true },
      { id:15, text:"When AED arrives — attach pads, follow voice prompts", section:"PROCEDURE", mark:0.5, critical:false },
      { id:16, text:"Shout CLEAR — ensure nobody touching patient before shock", section:"PROCEDURE", mark:0.5, critical:true },
      { id:17, text:"Resume CPR immediately after shock — do NOT check pulse first", section:"PROCEDURE", mark:0.5, critical:true },
      { id:18, text:"Continue until advanced help arrives or patient recovers", section:"FINISHING", mark:0.5, critical:true },
      { id:19, text:"Document all events with exact times", section:"FINISHING", mark:0.5, critical:false },
    ],
    distractors: ["Check pulse for 30 seconds before starting CPR","Leave patient to call for help yourself","Give rescue breaths before checking breathing","Compress only 2-3cm deep","Give 15 compressions to 2 breaths","Touch patient when AED delivers shock","Stop CPR to check pulse every 5 cycles"],
    quiz_context: "BLS algorithm, CPR compression depth and rate, 30:2 ratio, head tilt chin lift, rescue breathing, AED use, chain of survival, agonal breathing"
  },
]

const ALL_PROCEDURES = [...PROCEDURES, ...EXTRA_PROCEDURES]
const LEADERBOARD = [
  { name:"Adunola Bello", matric:"NSG/2022/001", dept:"Nursing", xp:3240, streak:7, badges:["🏆","⭐","🔥"] },
  { name:"Precious Ogunade", matric:"NSG/2023/001", dept:"Nursing", xp:2680, streak:4, badges:["⭐","🔥"] },
  { name:"Chioma Obiagwu", matric:"NSG/2021/001", dept:"Nursing", xp:2140, streak:2, badges:["⭐"] },
  { name:"Blessing Adeyemi", matric:"MID/2026/001", dept:"Midwifery", xp:1980, streak:5, badges:["🔥","⭐"] },
  { name:"Fatima Ibrahim", matric:"NSG/2022/002", dept:"Nursing", xp:1620, streak:3, badges:[] },
  { name:"Chidinma Eze", matric:"MID/2025/001", dept:"Midwifery", xp:1340, streak:1, badges:[] },
  { name:"Ngozi Ibrahim", matric:"MID/2023/001", dept:"Midwifery", xp:1100, streak:0, badges:[] },
  { name:"Emeka Okafor", matric:"NSG/2021/002", dept:"Nursing", xp:890, streak:0, badges:[] },
]

const LEVELS = [
  { name:"Student Nurse", min:0, color:C.muted },
  { name:"Staff Nurse", min:500, color:C.green },
  { name:"Senior Nurse", min:1500, color:C.purple },
  { name:"Ward Sister", min:3000, color:C.gold },
  { name:"Matron", min:5000, color:C.red },
]

function getLvl(xp: number) { for(let i=LEVELS.length-1;i>=0;i--){if(xp>=LEVELS[i].min)return LEVELS[i];} return LEVELS[0]; }
function shuffleArr(a: any[]) { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
*{box-sizing:border-box;}
.sim-app{font-family:'Outfit',sans-serif;background:${C.bg};min-height:100vh;}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes flashG{0%{background:#DCFCE7;border-color:#065F46}100%{background:#fff;border-color:${C.border}}}
@keyframes flashR{0%{background:#FEE2E2;border-color:#991B1B;transform:translateX(-4px)}50%{transform:translateX(4px)}100%{background:#fff;border-color:${C.border};transform:translateX(0)}}
@keyframes pop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes starPop{0%{transform:scale(0) rotate(-20deg)}70%{transform:scale(1.3)}100%{transform:scale(1)}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.sim-card{background:#fff;border-radius:16px;border:1px solid ${C.border};padding:16px;}
.sim-btn-navy{background:${C.navy};color:#fff;border:none;border-radius:12px;padding:14px 20px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;width:100%;transition:all 0.15s;}
.sim-btn-navy:hover{background:#234E70;}
.sim-btn-purple{background:${C.purple};color:#fff;border:none;border-radius:12px;padding:14px 20px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;width:100%;transition:all 0.15s;}
.sim-btn-gold{background:${C.gold};color:#fff;border:none;border-radius:12px;padding:14px 20px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;width:100%;transition:all 0.15s;}
.sim-btn-outline{background:#fff;color:${C.text};border:1.5px solid ${C.border};border-radius:12px;padding:13px 20px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;width:100%;transition:all 0.15s;}
.sim-mode-btn{background:#fff;border:2px solid ${C.border};border-radius:20px;padding:0;cursor:pointer;text-align:left;overflow:hidden;transition:all 0.2s;width:100%;}
.sim-mode-btn:hover{border-color:${C.navy};box-shadow:0 6px 20px rgba(27,67,50,0.1);transform:translateY(-2px);}
.sim-action-card{background:#fff;border:2px solid ${C.border};border-radius:16px;padding:14px;cursor:pointer;text-align:left;width:100%;transition:all 0.18s;font-family:inherit;}
.sim-action-card:hover{border-color:${C.purple};transform:translateY(-2px);}
.sim-tab{background:transparent;border:1.5px solid ${C.border};border-radius:20px;padding:6px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:${C.muted};transition:all 0.15s;}
.sim-tab.active{background:${C.navy};color:#fff;border-color:${C.navy};}
`

export default function Simulation() {
  const [screen, setScreen] = useState('home')
  const [lbTab, setLbTab] = useState('all')
  const [proc, setProc] = useState<any>(null)
  const [playerXP, setPlayerXP] = useState(0)
  const [playerStreak, setPlayerStreak] = useState(0)
  const [realLeaderboard, setRealLeaderboard] = useState<any[]>([])
  const [lbLoading, setLbLoading] = useState(true)

  // Practice
  const [pIdx, setPIdx] = useState(0)
  const [pDone, setPDone] = useState<number[]>([])
  const [pSkipped, setPSkipped] = useState<number[]>([])
  const [pTime, setPTime] = useState(0)
  const [pScore, setPScore] = useState(0)
  const [pFeedback, setPFeedback] = useState<string|null>(null)
  const [pFinished, setPFinished] = useState(false)

  // Exam
  const [eStepIdx, setEStepIdx] = useState(0)
  const [eScore, setEScore] = useState(0)
  const [eOptions, setEOptions] = useState<any[]>([])
  const [eSelected, setESelected] = useState<any>(null)
  const [eCorrectId, setECorrectId] = useState<any>(null)
  const [eNotes, setENotes] = useState<any[]>([])
  const [eMissed, setEMissed] = useState<any[]>([])
  const [eFinished, setEFinished] = useState(false)

  // Quiz
  const [qQuestions, setQQuestions] = useState<any[]>([])
  const [qIdx, setQIdx] = useState(0)
  const [qScore, setQScore] = useState(0)
  const [qAnswer, setQAnswer] = useState('')
  const [qResult, setQResult] = useState<any>(null)
  const [qLoading, setQLoading] = useState(false)
  const [qHistory, setQHistory] = useState<any[]>([])
  const [qGenerating, setQGenerating] = useState(false)
  const [qTime, setQTime] = useState(90)

  // Viva
  const [vQuestions, setVQuestions] = useState<any[]>([])
  const [vIdx, setVIdx] = useState(0)
  const [vAnswer, setVAnswer] = useState('')
  const [vResult, setVResult] = useState<any>(null)
  const [vLoading, setVLoading] = useState(false)
  const [vHistory, setVHistory] = useState<any[]>([])
  const [vTotal, setVTotal] = useState(0)
  const [vGenerating, setVGenerating] = useState(false)

  // Result
  const [resultMode, setResultMode] = useState<string|null>(null)

  const timerRef = useRef<any>(null)

  useEffect(() => {
    if (screen !== 'practice' || pFinished) return
    timerRef.current = setInterval(() => {
      setPTime(t => { if(t<=1){clearInterval(timerRef.current);finishPractice();return 0;} return t-1; })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [screen, pFinished])

  useEffect(() => {
    if (screen !== 'quiz' || !qQuestions.length || qResult) return
    timerRef.current = setInterval(() => {
      setQTime(t => {
        if(t<=1){
          clearInterval(timerRef.current)
          const q = qQuestions[qIdx]
          setQResult({ score:0, feedback:'Time expired. No marks for this question.', pearl: q.type==='mcq'?`Correct: (${q.answer?.toUpperCase()}) — ${q.explanation}`:q.model_answer })
          setQHistory((h:any[]) => [...h, { q:q.q, score:0, type:q.type }])
          return 0
        }
        return t-1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [screen, qIdx, qResult, qQuestions])

  function finishPractice() {
    setPFinished(true); setResultMode('practice')
    const xp = proc ? Math.round((pScore/proc.total_marks)*proc.xp) : 0
    if (proc) saveScore(proc.id, proc.title, 'practice', pScore, proc.total_marks, xp, pScore/proc.total_marks >= 0.5)
    setTimeout(() => setScreen('result'), 400)
  }

  function startPractice(p: any) {
    setProc(p); setPIdx(0); setPDone([]); setPSkipped([])
    setPTime(p.steps.length * 12); setPScore(0); setPFinished(false); setPFeedback(null)
    setScreen('practice')
  }

  function practiceNext(skipped: boolean) {
    const step = proc.steps[pIdx]
    if (skipped) { setPSkipped((s:number[]) => [...s, step.id]); setPFeedback('skipped') }
    else { setPDone((d:number[]) => [...d, step.id]); setPScore((s:number) => s + step.mark); setPFeedback('good') }
    setTimeout(() => {
      setPFeedback(null)
      if (pIdx + 1 >= proc.steps.length) { finishPractice() }
      else { setPIdx((i:number) => i+1) }
    }, 600)
  }

  function buildExamOptions(stepIdx: number, steps: any[], distractors: string[]) {
    const correct = steps[stepIdx]
    const wrongs = shuffleArr(distractors).slice(0,3).map((d:string) => ({ id:`d_${d}`, text:d, isDistractor:true }))
    return shuffleArr([{ id:correct.id, text:correct.text, isDistractor:false }, ...wrongs])
  }

  function startExam(p: any) {
    setProc(p); setEStepIdx(0); setEScore(0); setESelected(null); setECorrectId(null)
    setENotes([]); setEFinished(false); setEMissed([])
    setEOptions(buildExamOptions(0, p.steps, p.distractors))
    setScreen('exam')
  }

  function selectExamOption(opt: any) {
    if (eSelected !== null) return
    setESelected(opt.id)
    const correct = proc.steps[eStepIdx]
    setECorrectId(correct.id)
    if (!opt.isDistractor) {
      setEScore((s:number) => s + correct.mark)
      setENotes((n:any[]) => [...n, { type:'good', text:`✓ ${correct.text.substring(0,60)}...` }])
    } else {
      setENotes((n:any[]) => [...n, { type:'bad', text:`✗ Wrong. Expected: ${correct.text.substring(0,50)}...` }])
      setEMissed((m:any[]) => [...m, correct])
    }
    setTimeout(() => {
      const nextIdx = eStepIdx + 1
      if (nextIdx >= proc.steps.length) {
        setEFinished(true); setResultMode('exam')
        if (proc) saveScore(proc.id, proc.title, 'exam', eScore, proc.total_marks, Math.round((eScore/proc.total_marks)*proc.xp), eScore/proc.total_marks >= 0.5)
        setTimeout(() => setScreen('result'), 400)
      }
      else { setEStepIdx(nextIdx); setESelected(null); setECorrectId(null); setEOptions(buildExamOptions(nextIdx, proc.steps, proc.distractors)) }
    }, 1200)
  }

  function getFallbackQuestions(p: any) {
    return [
      { type:'mcq', q:`What is the FIRST step before performing ${p.title}?`, options:['a. Gather equipment','b. Greet patient and introduce yourself','c. Wash hands','d. Put on gloves'], answer:'b', explanation:'Patient greeting and introduction is always the first step in any nursing procedure.' },
      { type:'mcq', q:'Informed consent must be obtained:', options:['a. Only for surgical procedures','b. Before any procedure from a conscious patient','c. By the doctor not the nurse','d. Written form only'], answer:'b', explanation:'Informed consent must be obtained from any conscious competent patient before any procedure.' },
      { type:'mcq', q:'Hand hygiene should be performed:', options:['a. Only at end of shift','b. Before AND after patient contact','c. Only when visibly dirty','d. Once per shift'], answer:'b', explanation:'WHO recommends hand hygiene before and after patient contact as standard precaution.' },
      { type:'mcq', q:'NMCN stands for:', options:['a. National Medical Council Nigeria','b. Nursing and Midwifery Council of Nigeria','c. National Medical Certification Nigeria','d. Nursing Methods and Care Nigeria'], answer:'b', explanation:'NMCN is the regulatory body for nursing and midwifery in Nigeria.' },
      { type:'mcq', q:'Complete documentation must include:', options:['a. Time and signature only','b. Date, time, procedure, patient response, nurse signature','c. Only the outcome','d. Doctor name and ward number'], answer:'b', explanation:'Complete documentation includes date, time, what was done, patient response, and nurse signature.' },
      { type:'short', q:`State THREE critical steps in ${p.title} and explain why each is critical.`, model_answer:'Identify 3 critical steps and give clinical rationale: patient safety, infection prevention, legal requirements, or clinical effectiveness.' },
      { type:'mcq', q:'Standard precautions apply to:', options:['a. Only patients with known infections','b. All patients regardless of diagnosis','c. Only surgical patients','d. Only when blood is visible'], answer:'b', explanation:'Standard precautions apply to ALL patients regardless of diagnosis.' },
      { type:'mcq', q:'Used needles and syringes must be disposed into:', options:['a. Black bag — general waste','b. Yellow bag — clinical waste','c. Sharps container only','d. Green bag — recyclable'], answer:'c', explanation:'Sharps must ONLY go into sharps containers to prevent needle-stick injury.' },
      { type:'short', q:`A patient refuses ${p.title}. What should you do?`, model_answer:'Respect refusal. Explain importance clearly. Do NOT proceed without consent. Document refusal. Inform supervising nurse and doctor.' },
      { type:'mcq', q:'Normal adult blood pressure is:', options:['a. 100/60 mmHg','b. 120/80 mmHg','c. 140/90 mmHg','d. 160/100 mmHg'], answer:'b', explanation:'Normal adult BP is 120/80 mmHg. ≥140/90 = hypertension. <90/60 = hypotension.' },
      { type:'mcq', q:'Normal adult respiratory rate is:', options:['a. 8-12 breaths/min','b. 12-20 breaths/min','c. 20-30 breaths/min','d. 25-35 breaths/min'], answer:'b', explanation:'Normal adult RR is 12-20/min. <12 = bradypnoea, >20 = tachypnoea.' },
      { type:'mcq', q:'Aseptic technique is MOST important when:', options:['a. Taking blood pressure','b. Performing any invasive procedure','c. Giving oral medications','d. Measuring height and weight'], answer:'b', explanation:'Aseptic technique is essential for all invasive procedures to prevent infection.' },
      { type:'short', q:'Define infection control and list FOUR standard precautions.', model_answer:'Infection control: measures to prevent spread of infection. Standard precautions: hand hygiene, PPE (gloves/apron/mask), safe sharps handling, proper waste disposal, respiratory hygiene.' },
      { type:'mcq', q:'Signs of wound infection include:', options:['a. Pink healing edges','b. Minimal serous drainage','c. Pus, offensive odour, redness, warmth, swelling','d. Dry wound surface'], answer:'c', explanation:'Signs of infection: purulent discharge, offensive odour, erythema, warmth, oedema, pain.' },
      { type:'mcq', q:'Abnormal vital signs should be escalated:', options:['a. At end of shift','b. After documenting first','c. Immediately upon identification','d. Only if patient is conscious'], answer:'c', explanation:'Abnormal vital signs must be escalated IMMEDIATELY — delay can be life-threatening.' },
    ]
  }

  async function generateQuiz(p: any) {
    setQGenerating(true)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:2000,
          system:`You are an NMCN exam question writer. Generate exactly 15 exam questions about: ${p.quiz_context}. Mix: 10 MCQ (4 options each) and 5 short answer. Use Nigerian nursing context. Reply ONLY with valid JSON array: [{"type":"mcq","q":"question","options":["a. opt","b. opt","c. opt","d. opt"],"answer":"a","explanation":"why"},{"type":"short","q":"question","model_answer":"key points"}]. No markdown, no preamble.`,
          messages:[{ role:'user', content:`Generate 15 NMCN exam questions for: ${p.title}` }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || '[]'
      const qs = JSON.parse(text.replace(/```json|```/g,'').trim())
      setQQuestions(shuffleArr(qs).slice(0,15))
    } catch {
      setQQuestions(getFallbackQuestions(p))
    }
    setQIdx(0); setQScore(0); setQAnswer(''); setQResult(null)
    setQHistory([]); setQTime(90); setResultMode(null)
    setQGenerating(false); setScreen('quiz')
  }

  async function submitQuizAnswer() {
    const q = qQuestions[qIdx]
    clearInterval(timerRef.current)
    if (q.type === 'mcq') {
      const correct = qAnswer === q.answer
      setQResult({ score:correct?100:0, feedback:correct?'Correct! '+q.explanation:`Incorrect. Answer: (${q.answer?.toUpperCase()}) — ${q.explanation}`, pearl:null })
      setQScore((s:number) => s + (correct?1:0))
      setQHistory((h:any[]) => [...h, { q:q.q, score:correct?100:0, type:'mcq' }])
    } else {
      setQLoading(true)
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            model:'claude-sonnet-4-20250514', max_tokens:300,
            system:`NMCN nursing examiner. Model answer: "${q.model_answer}". Score 0-100. Reply ONLY JSON: {"score":number,"feedback":"2 sentences","pearl":"one teaching point"}`,
            messages:[{ role:'user', content:`Q: ${q.q}\nAnswer: ${qAnswer}` }]
          })
        })
        const data = await res.json()
        const result = JSON.parse(data.content?.[0]?.text.replace(/```json|```/g,'').trim() || '{"score":50,"feedback":"Review answer.","pearl":""}')
        setQResult(result)
        setQScore((s:number) => s + (result.score>=50?1:0))
        setQHistory((h:any[]) => [...h, { q:q.q, score:result.score, type:'short' }])
      } catch {
        setQResult({ score:50, feedback:'Examiner unavailable.', pearl:q.model_answer })
        setQHistory((h:any[]) => [...h, { q:q.q, score:50, type:'short' }])
      }
      setQLoading(false)
    }
  }

  function nextQuizQ() {
    if (qIdx + 1 >= qQuestions.length) {
      setResultMode('quiz')
      if (proc) saveScore(proc.id, proc.title, 'quiz', qScore, qQuestions.length, Math.round((qScore/qQuestions.length)*80), qScore/qQuestions.length >= 0.5)
      setScreen('result')
    }
    else { setQIdx((i:number) => i+1); setQAnswer(''); setQResult(null); setQTime(90) }
  }

  async function generateViva(p: any) {
    setVGenerating(true)
    const fallbackViva = [
      { q: `What are the key principles of aseptic technique when performing ${p.title}?`, expected: 'Sterile equipment, avoid contamination, hand hygiene, sterile field, PPE' },
      { q: `What are THREE complications that could occur if ${p.title} is performed incorrectly?`, expected: 'Infection, injury, pain, bleeding, wrong patient/drug/dose, legal liability' },
      { q: `How would you obtain informed consent from a patient before ${p.title}?`, expected: 'Explain procedure, purpose, risks, benefits, alternatives. Confirm understanding. Allow questions. Patient signs or verbally consents. Document.' },
      { q: `What documentation is required after performing ${p.title}?`, expected: 'Date, time, procedure performed, patient response, any complications, nurse name and signature, countersigned by senior if required.' },
      { q: `A patient becomes unwell during ${p.title}. What is your immediate response?`, expected: 'Stop procedure. Assess patient ABCDE. Call for help. Take vital signs. Inform senior nurse and doctor. Document incident. Comfort patient.' },
    ]
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          system: `You are an NMCN oral examiner preparing viva questions for ${p.title}. Generate exactly 5 clinical viva questions that test deep understanding, not just recall. Questions should reflect Nigerian ward practice. Reply ONLY with valid JSON array: [{"q":"question","expected":"key points expected in answer"}]. No markdown, no preamble.`,
          messages: [{ role: 'user', content: `Generate 5 viva questions for NMCN ${p.title} exam` }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || '[]'
      const qs = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, '').trim())
      setVQuestions(qs.length >= 5 ? qs : fallbackViva)
    } catch {
      setVQuestions(fallbackViva)
    }
    setVIdx(0); setVAnswer(''); setVResult(null)
    setVHistory([]); setVTotal(0); setVGenerating(false)
    setScreen('viva')
  }

  async function submitViva() {
    if (!vAnswer.trim() || vLoading) return
    setVLoading(true)
    const q = vQuestions[vIdx]
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 350,
          system: `You are a strict but fair NMCN oral examiner. Expected key points: "${q.expected}". Score student answer 0-100 based on accuracy and completeness. Reply ONLY with valid JSON: {"score":number,"feedback":"2-3 sentence assessment","pearl":"one key clinical teaching point"}`,
          messages: [{ role: 'user', content: `Question: ${q.q}\nStudent answer: ${vAnswer}` }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || '{}'
      const result = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, '').trim())
      setVResult(result)
      setVTotal((t: number) => t + result.score)
      setVHistory((h: any[]) => [...h, { q: q.q, score: result.score, answer: vAnswer }])
    } catch {
      setVResult({ score: 50, feedback: 'Examiner unavailable. Review your notes.', pearl: q.expected })
      setVHistory((h: any[]) => [...h, { q: q.q, score: 50, answer: vAnswer }])
    }
    setVLoading(false)
  }

  function nextVivaQ() {
    if (vIdx + 1 >= vQuestions.length) {
      setResultMode('viva')
      const avg = vHistory.length ? Math.round((vTotal + vResult.score) / (vHistory.length + 1)) : 0
      if (proc) saveScore(proc.id, proc.title, 'viva', avg, 100, Math.round(avg * 0.4), avg >= 50)
      setScreen('result')
    }
    else { setVIdx((i: number) => i + 1); setVAnswer(''); setVResult(null) }
  }

  useEffect(() => {
    // Load player XP
    fetch(`${API}/api/simulation/my-xp`, { headers: authHeaders() })
      .then(r => r.json()).then(d => { setPlayerXP(d.total_xp || 0); setPlayerStreak(d.streak || 0) }).catch(() => {})
    // Load leaderboard
    fetch(`${API}/api/simulation/leaderboard?dept=all`, { headers: authHeaders() })
      .then(r => r.json()).then(d => { setRealLeaderboard(d.leaderboard || []); setLbLoading(false) }).catch(() => setLbLoading(false))
  }, [])

  useEffect(() => {
    if (!lbTab) return
    const dept = lbTab === 'all' ? 'all' : lbTab
    fetch(`${API}/api/simulation/leaderboard?dept=${encodeURIComponent(dept)}`, { headers: authHeaders() })
      .then(r => r.json()).then(d => setRealLeaderboard(d.leaderboard || [])).catch(() => {})
  }, [lbTab])

  async function saveScore(procedureId: string, procedureTitle: string, mode: string, score: number, total: number, xpEarned: number, passed: boolean) {
    try {
      const res = await fetch(`${API}/api/simulation/score`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ procedure_id: procedureId, procedure_title: procedureTitle, mode, score, total, xp_earned: xpEarned, passed })
      })
      const data = await res.json()
      if (data.total_xp !== undefined) { setPlayerXP(data.total_xp); setPlayerStreak(data.streak || 0) }
    } catch {}
  }

  const level = getLvl(playerXP)
  const nextLvl = LEVELS[LEVELS.indexOf(level)+1]
  const lvlPct = nextLvl ? Math.round(((playerXP-level.min)/(nextLvl.min-level.min))*100) : 100
  const pPct = proc ? Math.round((pScore/proc.total_marks)*100) : 0
  const ePct = proc ? Math.round((eScore/proc.total_marks)*100) : 0
  const qPct = qQuestions.length ? Math.round((qScore/qQuestions.length)*100) : 0

  if (screen === 'home') return (
    <div className="sim-app">
      <style>{CSS}</style>
      <div style={{background:`linear-gradient(135deg,${C.navy},${C.purple})`,padding:'24px 16px 28px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:-40,right:-40,width:160,height:160,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.07)'}}/>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',letterSpacing:3,textTransform:'uppercase',marginBottom:2}}>CampusOS</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <div style={{fontSize:26,fontWeight:900,color:'#fff'}}>Clinical Trainer</div>
          {playerStreak>0 && <div style={{background:'rgba(212,162,76,0.25)',border:'1px solid rgba(212,162,76,0.5)',borderRadius:20,padding:'4px 12px',fontSize:12,color:'#D4A24C',fontWeight:800}}>🔥 {playerStreak}-day streak</div>}
        </div>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',marginBottom:16}}>NMCN-aligned · {ALL_PROCEDURES.length} procedures · 4 modes</div>
        <div style={{background:'rgba(255,255,255,0.1)',borderRadius:12,padding:'12px 14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontSize:13,fontWeight:800,color:'#fff'}}>{level.name}</span>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.5)'}}>{playerXP.toLocaleString()} XP</span>
          </div>
          <div style={{height:6,background:'rgba(255,255,255,0.15)',borderRadius:3}}>
            <div style={{height:'100%',width:`${lvlPct}%`,background:C.gold,borderRadius:3}}/>
          </div>
          {nextLvl && <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:4}}>→ {nextLvl.name} in {(nextLvl.min-playerXP).toLocaleString()} XP</div>}
        </div>
      </div>
      <div style={{padding:'16px 16px 80px'}}>
        <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:2,marginBottom:10}}>Training Modes</div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
          {[
            {icon:'🔵',label:'Practice Mode',desc:'Step-by-step reveal. Tap Done or Skip. Learn the procedure flow.',color:C.navy,bg:'#EFF6FF'},
            {icon:'🏥',label:'Ward Simulation',desc:'Real clinical scenario. Choose the correct nursing action.',color:C.purple,bg:'#F3F0FF'},
            {icon:'✍️',label:'Writing Station',desc:'AI generates 15 random NMCN-style exam questions.',color:C.gold,bg:'#FFFBEB'},
            {icon:'🎓',label:'Viva Challenge',desc:'AI oral examiner. Answer 5 clinical questions. Scored with feedback.',color:'#E63946',bg:'#FEF2F2'},
          ].map(m => (
            <button key={m.label} className="sim-mode-btn" onClick={() => setScreen('select')}>
              <div style={{display:'flex'}}>
                <div style={{width:5,background:m.color,flexShrink:0}}/>
                <div style={{padding:14,flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                    <div style={{width:40,height:40,borderRadius:10,background:m.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{m.icon}</div>
                    <div>
                      <div style={{fontSize:15,fontWeight:800,color:C.text}}>{m.label}</div>
                      <div style={{fontSize:12,color:C.muted}}>{m.desc}</div>
                    </div>
                  </div>
                </div>
                <div style={{padding:'0 14px',color:C.muted,fontSize:20,display:'flex',alignItems:'center'}}>›</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:2}}>🏆 Leaderboard</div>
          <div style={{display:'flex',gap:6}}>
            {['all','Nursing','Midwifery'].map(t => (
              <button key={t} className={`sim-tab ${lbTab===t?'active':''}`} onClick={() => setLbTab(t)}>{t==='all'?'All':t}</button>
            ))}
          </div>
        </div>
        <div className="sim-card" style={{padding:0,overflow:'hidden'}}>
          {lbLoading ? (
            <div className="p-8 text-center text-sm" style={{color:C.muted}}>Loading leaderboard...</div>
          ) : realLeaderboard.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{color:C.muted}}>No scores yet. Be the first to play!</div>
          ) : null}
          {realLeaderboard.map((s: any,i: number) => {
            const isMe = s.matric_no === localStorage.getItem('campusos_matric')
            const lv = getLvl(Number(s.total_xp) || 0)
            const sxp = Number(s.total_xp) || 0
            const sstreak = Number(s.streak) || 0
            const sname = (s.name || 'Unknown').toString()
            const sdept = (s.department || s.dept || '').toString()
            const hue = sname.charCodeAt(0)*137%360
            return (
              <div key={String(s.id || s.matric_no || i)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderBottom:`1px solid ${C.border}`,background:isMe?'#F3F0FF':'#fff'}}>
                <div style={{width:26,textAlign:'center',fontSize:i<3?18:13,fontWeight:700,color:C.muted,flexShrink:0}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
                <div style={{width:34,height:34,borderRadius:'50%',background:`hsl(${hue},40%,85%)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:`hsl(${hue},40%,30%)`,flexShrink:0}}>
                  {sname.split(' ').map((w:string)=>w[0]).slice(0,2).join('')}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <span style={{fontSize:13,fontWeight:isMe?800:600,color:C.text}}>{sname.split(' ')[0]}</span>
                    {isMe && <span style={{fontSize:9,fontWeight:800,color:C.purple,background:'#F3F0FF',border:`1px solid ${C.purple}44`,borderRadius:5,padding:'1px 5px'}}>YOU</span>}
                    {sstreak>0 && <span style={{fontSize:10,color:C.gold}}>🔥{sstreak}</span>}

                  </div>
                  <div style={{fontSize:10,color:C.muted}}>{sdept} · {lv.name}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:15,fontWeight:800,color:lv.color}}>{sxp.toLocaleString()}</div>
                  <div style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>XP</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  if (screen === 'select') return (
    <div className="sim-app">
      <style>{CSS}</style>
      <div style={{background:`linear-gradient(135deg,${C.navy},${C.purple})`,padding:'20px 16px 24px'}}>
        <button onClick={() => setScreen('home')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.6)',fontSize:14,cursor:'pointer',padding:'0 0 10px',fontFamily:'inherit'}}>‹ Back</button>
        <div style={{fontSize:22,fontWeight:900,color:'#fff'}}>Choose a Procedure</div>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',marginTop:4}}>Then select your training mode</div>
      </div>
      <div style={{padding:'16px 16px 60px',display:'flex',flexDirection:'column',gap:10}}>
        {ALL_PROCEDURES.map((p,i) => (
          <button key={p.id} className="sim-mode-btn" onClick={() => { setProc(p); setScreen('modes') }} style={{animation:`fadeUp 0.3s ease ${i*0.06}s both`}}>
            <div style={{display:'flex'}}>
              <div style={{width:5,background:p.accent,flexShrink:0}}/>
              <div style={{padding:'13px 14px',flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{fontSize:22}}>{p.icon}</span>
                  <span style={{fontSize:15,fontWeight:800,color:C.text}}>{p.title}</span>
                  <span style={{fontSize:10,fontWeight:700,background:p.difficulty==='Beginner'?'#DCFCE7':p.difficulty==='Intermediate'?'#FEF3C7':'#FEE2E2',color:p.difficulty==='Beginner'?C.green:p.difficulty==='Intermediate'?'#92400E':'#991B1B',borderRadius:5,padding:'2px 7px'}}>{p.difficulty}</span>
                </div>
                <div style={{display:'flex',gap:12,fontSize:11,color:C.muted}}>
                  <span>📋 {p.steps.length} steps</span>
                  <span>🏅 {p.total_marks} marks</span>
                  <span style={{color:'#991B1B'}}>🔴 {p.steps.filter((s:any)=>s.critical).length} critical</span>
                </div>
              </div>
              <div style={{padding:'0 14px',color:C.muted,fontSize:20,display:'flex',alignItems:'center'}}>›</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  if (screen === 'modes') return (
    <div className="sim-app">
      <style>{CSS}</style>
      <div style={{background:`linear-gradient(135deg,${proc.accent},${C.purple})`,padding:'20px 16px 24px'}}>
        <button onClick={() => setScreen('select')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.6)',fontSize:14,cursor:'pointer',padding:'0 0 10px',fontFamily:'inherit'}}>‹ Back</button>
        <div style={{fontSize:22,fontWeight:900,color:'#fff'}}>{proc.icon} {proc.title}</div>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',marginTop:4}}>Select training mode</div>
      </div>
      <div style={{padding:16}}>
        <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
          <button className="sim-mode-btn" onClick={() => startPractice(proc)}>
            <div style={{display:'flex'}}>
              <div style={{width:5,background:C.navy}}/>
              <div style={{padding:16,flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{width:44,height:44,borderRadius:12,background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🔵</div>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:C.text}}>Practice Mode</div>
                    <div style={{fontSize:12,color:C.muted}}>Step-by-step with section labels</div>
                  </div>
                </div>
                <div style={{background:'#EFF6FF',borderRadius:10,padding:'8px 12px',fontSize:12,color:C.navy,lineHeight:1.5}}>
                  Each step revealed one at a time. Tap <strong>Done ✅</strong> to earn marks or <strong>Skip ⏭</strong> to lose marks. Best for learning the procedure flow.
                </div>
              </div>
            </div>
          </button>
          <button className="sim-mode-btn" onClick={() => startExam(proc)}>
            <div style={{display:'flex'}}>
              <div style={{width:5,background:C.purple}}/>
              <div style={{padding:16,flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{width:44,height:44,borderRadius:12,background:'#F3F0FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🏥</div>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:C.text}}>Ward Simulation</div>
                    <div style={{fontSize:12,color:C.muted}}>Real scenario — what do you do next?</div>
                  </div>
                </div>
                <div style={{background:'#F3F0FF',borderRadius:10,padding:'8px 12px',fontSize:12,color:C.purple,lineHeight:1.5}}>
                  You are in a real ward. At each step choose the correct action from 4 options. Distractors included. Examiner tracks your decisions.
                </div>
              </div>
            </div>
          </button>
          <button className="sim-mode-btn" onClick={() => generateQuiz(proc)} disabled={qGenerating}>
            <div style={{display:'flex'}}>
              <div style={{width:5,background:C.gold}}/>
              <div style={{padding:16,flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{width:44,height:44,borderRadius:12,background:'#FFFBEB',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>✍️</div>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:C.text}}>Writing Station</div>
                    <div style={{fontSize:12,color:C.muted}}>AI generates 15 unique exam questions</div>
                  </div>
                </div>
                {qGenerating
                  ? <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#92400E'}}><div style={{width:14,height:14,borderRadius:'50%',border:'2px solid #FDE68A',borderTopColor:C.gold,animation:'spin 0.8s linear infinite'}}/> Generating 15 NMCN questions...</div>
                  : <div style={{background:'#FFFBEB',borderRadius:10,padding:'8px 12px',fontSize:12,color:'#92400E',lineHeight:1.5}}>AI writes <strong>10 MCQ + 5 short answer</strong> questions. <strong>Randomized every attempt</strong>. 90 seconds per question.</div>
                }
              </div>
            </div>
          </button>
          <button className="sim-mode-btn" onClick={() => generateViva(proc)} disabled={vGenerating}>
            <div style={{display:'flex'}}>
              <div style={{width:5,background:'#E63946'}}/>
              <div style={{padding:16,flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <div style={{width:44,height:44,borderRadius:12,background:'#FEF2F2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>🎓</div>
                  <div>
                    <div style={{fontSize:16,fontWeight:800,color:C.text}}>Viva Challenge</div>
                    <div style={{fontSize:12,color:C.muted}}>AI oral examiner — 5 clinical questions</div>
                  </div>
                </div>
                {vGenerating
                  ? <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#991B1B'}}><div style={{width:14,height:14,borderRadius:'50%',border:'2px solid #FECACA',borderTopColor:'#E63946',animation:'spin 0.8s linear infinite'}}/> Preparing viva questions...</div>
                  : <div style={{background:'#FEF2F2',borderRadius:10,padding:'8px 12px',fontSize:12,color:'#991B1B',lineHeight:1.5}}>AI examiner asks <strong>5 deep clinical questions</strong>. Type your answers. Scored 0-100 with feedback and teaching points after each.</div>
                }
              </div>
            </div>
          </button>
        </div>
        <div className="sim-card" style={{background:'#F8FAFC'}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>📍 Scenario</div>
          <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:2}}>{proc.scenario.setting}</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:6}}>Patient: {proc.scenario.patient}</div>
          <div style={{fontSize:12,color:C.text,lineHeight:1.6}}>{proc.scenario.presenting}</div>
        </div>
      </div>
    </div>
  )

  if (screen === 'practice') {
    const currentStep = proc.steps[pIdx]
    const prevStep = pIdx > 0 ? proc.steps[pIdx-1] : null
    return (
      <div className="sim-app" style={{display:'flex',flexDirection:'column',minHeight:'100vh'}}>
        <style>{CSS}</style>
        <div style={{background:'#fff',borderBottom:`1px solid ${C.border}`,padding:'12px 16px',position:'sticky',top:0,zIndex:10}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={() => { clearInterval(timerRef.current); setScreen('modes') }} style={{background:'none',border:'none',color:C.muted,fontSize:20,cursor:'pointer',padding:0}}>‹</button>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:C.text}}>🔵 Practice — {proc.title}</div>
              <div style={{fontSize:11,color:C.muted}}>Step {pIdx+1} of {proc.steps.length} · {currentStep?.section}</div>
            </div>
            <div style={{background:pTime<20?'#FEE2E2':'#EFF6FF',borderRadius:8,padding:'4px 10px',fontFamily:'monospace',fontSize:13,fontWeight:900,color:pTime<20?'#991B1B':C.navy}}>
              {Math.floor(pTime/60)}:{String(pTime%60).padStart(2,'0')}
            </div>
          </div>
          <div style={{height:4,background:C.bg,borderRadius:2,marginTop:8}}>
            <div style={{height:'100%',width:`${(pIdx/proc.steps.length)*100}%`,background:proc.accent,borderRadius:2,transition:'width 0.4s'}}/>
          </div>
        </div>
        <div style={{background:C.bg,padding:'8px 16px',display:'flex',gap:16,borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:11,color:C.muted,textTransform:'uppercase'}}>Score</span>
            <span style={{fontSize:18,fontWeight:900,color:C.navy}}>{pScore.toFixed(1)}/{proc.total_marks}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:11,color:C.muted,textTransform:'uppercase'}}>Skipped</span>
            <span style={{fontSize:18,fontWeight:900,color:pSkipped.length>0?'#991B1B':C.border}}>{pSkipped.length}</span>
          </div>
        </div>
        <div style={{flex:1,padding:'16px 16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {prevStep && (
            <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:14,padding:'10px 14px',opacity:0.65}}>
              <div style={{fontSize:10,fontWeight:700,color:C.green,textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>✓ Previous step</div>
              <div style={{fontSize:12,color:C.text}}>{prevStep.text}</div>
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1,height:1,background:C.border}}/>
            <div style={{background:C.navy,color:'#fff',fontSize:10,fontWeight:800,padding:'3px 10px',borderRadius:20,textTransform:'uppercase',letterSpacing:1}}>{currentStep?.section}</div>
            <div style={{flex:1,height:1,background:C.border}}/>
          </div>
          <div className="sim-card" style={{borderLeft:`5px solid ${pFeedback==='good'?'#065F46':pFeedback==='skipped'?'#991B1B':proc.accent}`,transition:'all 0.3s',animation:pFeedback==='good'?'flashG 0.5s ease':pFeedback==='skipped'?'flashR 0.5s ease':'none'}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>What is Step {pIdx+1}?</div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,lineHeight:1.5,marginBottom:10}}>{currentStep?.text}</div>
            <div style={{display:'flex',gap:8}}>
              <div style={{fontSize:12,color:C.muted}}>{currentStep?.mark} mark{currentStep?.mark!==1?'s':''}</div>
              {currentStep?.critical && <span style={{fontSize:10,fontWeight:800,color:'#991B1B',background:'#FEE2E2',borderRadius:5,padding:'2px 7px'}}>CRITICAL</span>}
            </div>
          </div>
          <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:12,padding:'10px 14px'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#92400E',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>📚 Why this step matters</div>
            <div style={{fontSize:12,color:'#92400E',lineHeight:1.5}}>
              {currentStep?.critical
                ? 'This is a CRITICAL step. Omitting it in the real OSCE may result in automatic failure of this station. Practice until it becomes second nature.'
                : 'This step contributes to proper technique and patient safety. Marks are deducted if skipped in the exam.'}
            </div>
          </div>
          <div style={{display:'flex',gap:10,marginTop:'auto'}}>
            <button onClick={() => practiceNext(true)} style={{flex:1,padding:'14px 0',background:'#FEF2F2',border:'2px solid #FECACA',borderRadius:14,color:'#991B1B',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              ⏭ Skip (−{currentStep?.mark} mark)
            </button>
            <button onClick={() => practiceNext(false)} style={{flex:1,padding:'14px 0',background:'#F0FDF4',border:'2px solid #BBF7D0',borderRadius:14,color:C.green,fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              ✅ Done (+{currentStep?.mark} mark)
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'exam') {
    const currentStep = proc.steps[eStepIdx]
    return (
      <div className="sim-app" style={{display:'flex',flexDirection:'column',minHeight:'100vh'}}>
        <style>{CSS}</style>
        <div style={{background:C.navy,padding:'12px 16px 0'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <button onClick={() => setScreen('modes')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:20,cursor:'pointer',padding:0}}>‹</button>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:2}}>Ward Simulation</div>
              <div style={{fontSize:14,fontWeight:800,color:'#fff'}}>{proc.scenario.setting}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.1)',borderRadius:8,padding:'4px 10px',fontFamily:'monospace',fontSize:13,fontWeight:800,color:'#fff'}}>{eStepIdx+1}/{proc.steps.length}</div>
          </div>
          <div style={{background:'rgba(255,255,255,0.08)',borderRadius:'10px 10px 0 0',padding:'10px 14px'}}>
            <div style={{fontSize:12}}><span style={{color:'rgba(255,255,255,0.5)'}}>Patient: </span><span style={{color:'#fff',fontWeight:700}}>{proc.scenario.patient}</span></div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.6)',marginTop:4,lineHeight:1.4}}>{proc.scenario.presenting.substring(0,90)}...</div>
          </div>
        </div>
        {eNotes.length > 0 && (
          <div style={{background:'#F8FAFC',borderBottom:`1px solid ${C.border}`,padding:'8px 16px',maxHeight:72,overflowY:'auto'}}>
            {eNotes.slice(-3).map((n:any,i:number) => (
              <div key={i} style={{fontSize:11,color:n.type==='good'?C.green:'#991B1B',padding:'1px 0'}}>{n.text}</div>
            ))}
          </div>
        )}
        <div style={{flex:1,padding:'14px 16px 80px',overflowY:'auto'}}>
          <div style={{display:'flex',gap:10,marginBottom:14}}>
            {[{label:'Score',val:eScore.toFixed(1),color:C.navy},{label:'Correct',val:eStepIdx-eMissed.length,color:C.green},{label:'Missed',val:eMissed.length,color:'#991B1B'}].map(s => (
              <div key={s.label} className="sim-card" style={{flex:1,padding:'10px 12px',textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:900,color:s.color}}>{s.val}</div>
                <div style={{fontSize:10,color:C.muted,textTransform:'uppercase'}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{background:C.navy,borderRadius:16,padding:'14px 16px',marginBottom:14}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:2,marginBottom:6}}>🏥 What do you do next?</div>
            <div style={{fontSize:14,fontWeight:700,color:'#fff',lineHeight:1.5}}>
              {eStepIdx===0 ? `You have just arrived at ${proc.scenario.patient}'s bedside. What is your FIRST action?` : `You have completed step ${eStepIdx}. What is your NEXT action?`}
            </div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:6}}>
              Section: {currentStep?.section} · {currentStep?.mark} mark{currentStep?.mark!==1?'s':''}{currentStep?.critical?' · ⚠️ CRITICAL':''}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {eOptions.map((opt:any) => {
              let extra: any = {}
              if (eSelected !== null) {
                if (opt.id === eCorrectId) extra = { borderColor:'#065F46', background:'#F0FDF4' }
                else if (opt.id === eSelected && opt.isDistractor) extra = { borderColor:'#991B1B', background:'#FEF2F2' }
                else extra = { opacity:0.4 }
              }
              return (
                <button key={opt.id} className="sim-action-card" style={extra} onClick={() => selectExamOption(opt)}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:eSelected===null?C.bg:opt.id===eCorrectId?'#DCFCE7':opt.id===eSelected?'#FEE2E2':C.bg,border:`2px solid ${eSelected===null?C.border:opt.id===eCorrectId?'#065F46':opt.id===eSelected?'#991B1B':C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:eSelected===null?C.muted:opt.id===eCorrectId?C.green:'#991B1B',flexShrink:0,animation:opt.id===eCorrectId&&eSelected!==null?'pop 0.3s ease':'none'}}>
                      {eSelected===null?'?':(opt.id===eCorrectId?'✓':(opt.id===eSelected?'✗':'·'))}
                    </div>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,lineHeight:1.4}}>{opt.text}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'quiz') {
    const q = qQuestions[qIdx]
    if (!q) return null
    return (
      <div className="sim-app" style={{display:'flex',flexDirection:'column',minHeight:'100vh'}}>
        <style>{CSS}</style>
        <div style={{background:`linear-gradient(135deg,${C.gold},#B45309)`,padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <button onClick={() => { clearInterval(timerRef.current); setScreen('modes') }} style={{background:'none',border:'none',color:'rgba(255,255,255,0.6)',fontSize:20,cursor:'pointer',padding:0}}>‹</button>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:800,color:'#fff'}}>✍️ Writing Station — {proc.title}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.6)'}}>Question {qIdx+1} of {qQuestions.length} · {q.type==='mcq'?'MCQ':'Short Answer'}</div>
            </div>
            <div style={{background:qTime<20?'rgba(153,27,27,0.4)':'rgba(255,255,255,0.15)',border:`1px solid ${qTime<20?'#991B1B':'rgba(255,255,255,0.3)'}`,borderRadius:8,padding:'4px 12px',fontFamily:'monospace',fontSize:14,fontWeight:900,color:'#fff'}}>{qTime}s</div>
          </div>
          <div style={{display:'flex',gap:4}}>
            {qQuestions.map((_:any,i:number) => (
              <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<qIdx?'#fff':i===qIdx?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.2)',transition:'all 0.3s'}}/>
            ))}
          </div>
        </div>
        <div style={{flex:1,padding:'16px 16px 80px',overflowY:'auto'}}>
          <div className="sim-card" style={{marginBottom:14,borderLeft:`4px solid ${C.gold}`}}>
            <div style={{display:'flex',gap:8,marginBottom:8}}>
              <span style={{background:q.type==='mcq'?'#EFF6FF':'#F3F0FF',color:q.type==='mcq'?C.navy:C.purple,borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700}}>{q.type==='mcq'?'Multiple Choice':'Short Answer'}</span>
            </div>
            <div style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.5}}>{q.q}</div>
          </div>
          {q.type==='mcq' && !qResult && (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {q.options.map((opt:string,i:number) => {
                const letter = ['a','b','c','d'][i]
                const selected = qAnswer === letter
                return (
                  <button key={i} onClick={() => setQAnswer(letter)} style={{background:selected?`${C.navy}0F`:'#fff',border:`2px solid ${selected?C.navy:C.border}`,borderRadius:12,padding:'12px 14px',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:10,fontFamily:'inherit',transition:'all 0.15s'}}>
                    <div style={{width:24,height:24,borderRadius:'50%',background:selected?C.navy:C.bg,border:`2px solid ${selected?C.navy:C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:selected?'#fff':C.muted,flexShrink:0,transition:'all 0.15s'}}>{letter.toUpperCase()}</div>
                    <span style={{fontSize:13,color:C.text,fontWeight:selected?700:400}}>{opt}</span>
                  </button>
                )
              })}
            </div>
          )}
          {q.type==='short' && !qResult && (
            <textarea value={qAnswer} onChange={e => setQAnswer(e.target.value)} placeholder="Write your answer here..." rows={6}
              style={{width:'100%',background:'#fff',border:`1.5px solid ${C.border}`,borderRadius:14,padding:'12px 14px',color:C.text,fontSize:14,lineHeight:1.6,outline:'none',resize:'none',fontFamily:'inherit'}}
              onFocus={e => e.target.style.borderColor=C.gold} onBlur={e => e.target.style.borderColor=C.border}
            />
          )}
          {q.type==='mcq' && qResult && (
            <div>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
                {q.options.map((opt:string,i:number) => {
                  const letter = ['a','b','c','d'][i]
                  const isCorrect = letter===q.answer
                  const isSelected = letter===qAnswer
                  return (
                    <div key={i} style={{background:isCorrect?'#F0FDF4':isSelected&&!isCorrect?'#FEF2F2':'#fff',border:`2px solid ${isCorrect?'#065F46':isSelected&&!isCorrect?'#991B1B':C.border}`,borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
                      <div style={{width:24,height:24,borderRadius:'50%',background:isCorrect?'#065F46':isSelected?'#991B1B':C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:isCorrect||isSelected?'#fff':C.muted,flexShrink:0}}>
                        {isCorrect?'✓':isSelected?'✗':letter.toUpperCase()}
                      </div>
                      <span style={{fontSize:13,color:isCorrect?'#065F46':isSelected?'#991B1B':C.muted}}>{opt}</span>
                    </div>
                  )
                })}
              </div>
              <div className="sim-card" style={{background:qResult.score>0?'#F0FDF4':'#FEF2F2',borderColor:qResult.score>0?'#BBF7D0':'#FECACA'}}>
                <div style={{fontSize:13,color:C.text,lineHeight:1.6}}>{qResult.feedback}</div>
              </div>
            </div>
          )}
          {q.type==='short' && qResult && (
            <div>
              <div className="sim-card" style={{marginBottom:10,background:qResult.score>=50?'#F0FDF4':'#FEF2F2',borderColor:qResult.score>=50?'#BBF7D0':'#FECACA'}}>
                <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:6}}>
                  <div style={{fontSize:28,fontWeight:900,color:qResult.score>=70?C.green:qResult.score>=50?'#92400E':'#991B1B'}}>{qResult.score}</div>
                  <div style={{fontSize:13,color:C.text,lineHeight:1.5}}>{qResult.feedback}</div>
                </div>
              </div>
              {qResult.pearl && (
                <div className="sim-card" style={{background:'#FFFBEB',borderColor:'#FDE68A',borderLeft:`4px solid ${C.gold}`}}>
                  <div style={{fontSize:10,fontWeight:800,color:'#92400E',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>📚 Teaching Point</div>
                  <div style={{fontSize:12,color:'#92400E',lineHeight:1.5}}>{qResult.pearl}</div>
                </div>
              )}
            </div>
          )}
          {qLoading && (
            <div style={{display:'flex',alignItems:'center',gap:10,padding:16,justifyContent:'center'}}>
              <div style={{width:20,height:20,borderRadius:'50%',border:'3px solid #FDE68A',borderTopColor:C.gold,animation:'spin 0.8s linear infinite'}}/>
              <span style={{fontSize:13,color:C.muted}}>Examiner reviewing your answer...</span>
            </div>
          )}
        </div>
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:`1px solid ${C.border}`,padding:'12px 16px'}}>
          {!qResult
            ? <button className="sim-btn-gold" onClick={submitQuizAnswer} disabled={!qAnswer.trim()||qLoading} style={{opacity:!qAnswer.trim()?0.5:1}}>Submit Answer →</button>
            : <button className="sim-btn-gold" onClick={nextQuizQ}>{qIdx+1>=qQuestions.length?'See Final Results →':`Next Question (${qIdx+2}/${qQuestions.length}) →`}</button>
          }
        </div>
      </div>
    )
  }

  if (screen === 'result') {
    const isPractice = resultMode==='practice'
    const isExam = resultMode==='exam'
    const pct = isPractice?pPct:isExam?ePct:qPct
    const pass = pct >= 50
    const marksGot = isPractice?pScore.toFixed(1):isExam?eScore.toFixed(1):`${qScore}/${qQuestions.length}`
    const marksTotal = isPractice||isExam?proc.total_marks:qQuestions.length
    const missed = isExam?eMissed:isPractice?proc.steps.filter((s:any)=>pSkipped.includes(s.id)):[]
    const missedCritical = missed.filter((s:any)=>s.critical)
    return (
      <div className="sim-app" style={{padding:'16px 16px 60px',minHeight:'100vh'}}>
        <style>{CSS}</style>
        <div style={{maxWidth:400,margin:'0 auto',animation:'fadeUp 0.4s ease'}}>
          <div style={{textAlign:'center',marginBottom:20}}>
            <div style={{width:72,height:72,borderRadius:20,background:`${proc.accent}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,margin:'0 auto 12px'}}>{proc.icon}</div>
            <div style={{fontSize:24,fontWeight:900,color:C.text}}>{isPractice?'Practice Complete!':isExam?'Simulation Complete!':'Writing Station Done!'}</div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>{proc.title} · {isPractice?'Practice':isExam?'Ward Simulation':'Writing Station'}</div>
          </div>
          {!isExam && !isPractice ? null : (
            <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:20}}>
              {[1,2,3].map((s,i) => <div key={s} style={{fontSize:40,animation:s<=(pct>=80?3:pct>=60?2:1)?`starPop 0.5s ease ${i*0.15+0.2}s both`:'none',opacity:s<=(pct>=80?3:pct>=60?2:1)?1:0.15}}>⭐</div>)}
            </div>
          )}
          <div className="sim-card" style={{marginBottom:12,background:pass?'#F0FDF4':'#FEF2F2',borderColor:pass?'#BBF7D0':'#FECACA'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div>
                <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Marks Obtained</div>
                <div style={{fontSize:36,fontWeight:900,color:pass?C.green:'#991B1B',lineHeight:1}}>{marksGot}</div>
                <div style={{fontSize:12,color:C.muted}}>out of {marksTotal}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',letterSpacing:1}}>Grade</div>
                <div style={{fontSize:36,fontWeight:900,color:pass?C.green:'#991B1B',lineHeight:1}}>{pct}%</div>
                <div style={{fontSize:14,fontWeight:800,color:pass?C.green:'#991B1B'}}>{pass?'✓ PASS':'✗ FAIL'}</div>
              </div>
            </div>
          </div>
          <div className="sim-card" style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Examiner's Remark</div>
            <div style={{fontSize:13,color:C.text,lineHeight:1.6,fontStyle:'italic'}}>
              {pct>=80?'Excellent performance. Student demonstrates thorough clinical knowledge and proper technique throughout. Highly recommended.':pct>=60?'Good performance with areas for improvement. Strengthen critical steps and documentation habits.':'Performance below standard. Significant additional practice required. Focus on critical steps and infection control.'}
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:8,fontSize:11,color:C.muted,display:'flex',justifyContent:'space-between'}}>
              <span>Signature: _______________</span>
              <span>{new Date().toLocaleDateString('en-NG')}</span>
            </div>
          </div>
          {missedCritical.length > 0 && (
            <div className="sim-card" style={{marginBottom:12,background:'#FEF2F2',borderColor:'#FECACA'}}>
              <div style={{fontSize:11,fontWeight:800,color:'#991B1B',textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>⚠️ Critical Steps Missed</div>
              {missedCritical.map((s:any) => (
                <div key={s.id} style={{fontSize:12,color:'#991B1B',padding:'4px 0',borderBottom:'1px solid #FECACA'}}>• {s.text}</div>
              ))}
            </div>
          )}
          {isExam && qHistory.length===0 && eMissed.length>0 && missedCritical.length===0 && (
            <div className="sim-card" style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Steps Missed</div>
              {eMissed.filter((s:any)=>!s.critical).map((s:any) => (
                <div key={s.id} style={{fontSize:12,color:C.muted,padding:'3px 0',borderBottom:`1px solid ${C.border}`}}>• {s.text}</div>
              ))}
            </div>
          )}
          {resultMode==='quiz' && qHistory.length>0 && (
            <div className="sim-card" style={{marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Question Breakdown</div>
              {qHistory.map((h:any,i:number) => (
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:h.score>=50?'#F0FDF4':'#FEF2F2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,color:h.score>=50?C.green:'#991B1B'}}>
                    {h.type==='mcq'?(h.score===100?'✓':'✗'):h.score>=50?'✓':'✗'}
                  </div>
                  <div style={{fontSize:11,color:C.muted,flex:1,lineHeight:1.3}}>{h.q.substring(0,60)}...</div>
                </div>
              ))}
            </div>
          )}
          <div style={{display:'flex',gap:10}}>
            <button className="sim-btn-navy" style={{flex:1}} onClick={() => isPractice?startPractice(proc):isExam?startExam(proc):generateQuiz(proc)}>🔄 Try Again</button>
            <button className="sim-btn-outline" style={{flex:1}} onClick={() => setScreen('modes')}>Change Mode</button>
          </div>
          <button onClick={() => setScreen('home')} style={{background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',width:'100%',marginTop:10,fontFamily:'inherit'}}>← Home</button>
        </div>
      </div>
    )
  }

  if (screen === 'viva') {
    const q = vQuestions[vIdx]
    if (!q) return null
    const avgScore = vHistory.length ? Math.round(vHistory.reduce((s:number,h:any)=>s+h.score,0)/vHistory.length) : 0
    return (
      <div className="sim-app" style={{display:'flex',flexDirection:'column',minHeight:'100vh'}}>
        <style>{CSS}</style>
        <div style={{background:`linear-gradient(135deg,#991B1B,#E63946)`,padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <button onClick={() => setScreen('modes')} style={{background:'none',border:'none',color:'rgba(255,255,255,0.6)',fontSize:20,cursor:'pointer',padding:0}}>‹</button>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:800,color:'#fff'}}>🎓 Viva Challenge — {proc.title}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.6)'}}>Question {vIdx+1} of {vQuestions.length}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:20,padding:'4px 14px',fontSize:13,fontWeight:800,color:'#fff'}}>{vHistory.length>0?`Avg: ${Math.round(vTotal/vHistory.length)}%`:'—'}</div>
          </div>
          <div style={{display:'flex',gap:4}}>
            {vQuestions.map((_:any,i:number) => (
              <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<vIdx?'#fff':i===vIdx?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.2)',transition:'all 0.3s'}}/>
            ))}
          </div>
        </div>
        <div style={{flex:1,padding:'16px 16px 80px',overflowY:'auto'}}>
          <div className="sim-card" style={{marginBottom:14,borderLeft:'4px solid #E63946'}}>
            <div style={{display:'flex',gap:8,marginBottom:8}}>
              <span style={{background:'#FEF2F2',color:'#991B1B',borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700}}>ORAL EXAMINER</span>
              <span style={{background:'#F5F7FA',color:C.muted,borderRadius:6,padding:'2px 8px',fontSize:10,fontWeight:700}}>Q{vIdx+1}</span>
            </div>
            <div style={{fontSize:15,fontWeight:700,color:C.text,lineHeight:1.5}}>{q.q}</div>
          </div>
          <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:14}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:`linear-gradient(135deg,${C.navy},${C.purple})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>👩‍⚕️</div>
            <div className="sim-card" style={{borderRadius:'4px 16px 16px 16px',flex:1,padding:'10px 14px'}}>
              <div style={{fontSize:13,color:C.text,lineHeight:1.5}}>
                {vResult ? 'I have reviewed your answer. See my feedback below.' : 'Please answer clearly and completely. Use your clinical knowledge and ward experience. Take your time.'}
              </div>
            </div>
          </div>
          {!vResult && (
            <>
              <textarea value={vAnswer} onChange={(e:any) => setVAnswer(e.target.value)}
                placeholder="Type your answer here..."
                rows={6}
                style={{width:'100%',background:'#fff',border:`1.5px solid ${C.border}`,borderRadius:14,padding:'12px 14px',color:C.text,fontSize:14,lineHeight:1.6,outline:'none',resize:'none',fontFamily:'inherit'}}
                onFocus={(e:any) => e.target.style.borderColor='#E63946'} onBlur={(e:any) => e.target.style.borderColor=C.border}
              />
              {vLoading && (
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 0',justifyContent:'center'}}>
                  <div style={{width:18,height:18,borderRadius:'50%',border:'3px solid #FECACA',borderTopColor:'#E63946',animation:'spin 0.8s linear infinite'}}/>
                  <span style={{fontSize:13,color:C.muted}}>Examiner is evaluating your answer...</span>
                </div>
              )}
            </>
          )}
          {vResult && (
            <div style={{animation:'fadeUp 0.4s ease'}}>
              <div className="sim-card" style={{marginBottom:12,background:vResult.score>=70?'#F0FDF4':vResult.score>=50?'#FFFBEB':'#FEF2F2',borderColor:vResult.score>=70?'#BBF7D0':vResult.score>=50?'#FDE68A':'#FECACA'}}>
                <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
                  <div style={{textAlign:'center',flexShrink:0}}>
                    <div style={{fontSize:32,fontWeight:900,color:vResult.score>=70?C.green:vResult.score>=50?'#92400E':'#991B1B',lineHeight:1}}>{vResult.score}</div>
                    <div style={{fontSize:10,color:C.muted,textTransform:'uppercase'}}>/100</div>
                  </div>
                  <div style={{fontSize:13,color:C.text,lineHeight:1.6}}>{vResult.feedback}</div>
                </div>
              </div>
              {vResult.pearl && (
                <div className="sim-card" style={{background:'#FFFBEB',borderColor:'#FDE68A',borderLeft:`4px solid ${C.gold}`}}>
                  <div style={{fontSize:10,fontWeight:800,color:'#92400E',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>📚 Clinical Pearl</div>
                  <div style={{fontSize:12,color:'#92400E',lineHeight:1.5}}>{vResult.pearl}</div>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#fff',borderTop:`1px solid ${C.border}`,padding:'12px 16px'}}>
          {!vResult
            ? <button style={{background:!vAnswer.trim()||vLoading?C.muted:'#E63946',color:'#fff',border:'none',borderRadius:12,padding:'14px 20px',fontFamily:'inherit',fontSize:15,fontWeight:700,cursor:'pointer',width:'100%',transition:'all 0.15s',opacity:!vAnswer.trim()||vLoading?0.6:1}} onClick={submitViva} disabled={!vAnswer.trim()||vLoading}>Submit Answer →</button>
            : <button style={{background:'#E63946',color:'#fff',border:'none',borderRadius:12,padding:'14px 20px',fontFamily:'inherit',fontSize:15,fontWeight:700,cursor:'pointer',width:'100%'}} onClick={nextVivaQ}>{vIdx+1>=vQuestions.length?'See Final Results →':`Next Question (${vIdx+2}/${vQuestions.length}) →`}</button>
          }
        </div>
      </div>
    )
  }

  if (screen === 'result' && resultMode === 'viva') {
    const avgScore = vHistory.length ? Math.round(vTotal/vHistory.length) : 0
    const pass = avgScore >= 50
    return (
      <div className="sim-app" style={{padding:'16px 16px 60px',minHeight:'100vh'}}>
        <style>{CSS}</style>
        <div style={{maxWidth:400,margin:'0 auto',animation:'fadeUp 0.4s ease'}}>
          <div style={{textAlign:'center',marginBottom:20}}>
            <div style={{width:72,height:72,borderRadius:20,background:'#FEF2F2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36,margin:'0 auto 12px'}}>🎓</div>
            <div style={{fontSize:24,fontWeight:900,color:C.text}}>Viva Complete!</div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>{proc.title} · Viva Challenge</div>
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:12,marginBottom:20}}>
            {[1,2,3].map((s:number,i:number) => <div key={s} style={{fontSize:40,animation:s<=(avgScore>=80?3:avgScore>=60?2:1)?`starPop 0.5s ease ${i*0.15+0.2}s both`:'none',opacity:s<=(avgScore>=80?3:avgScore>=60?2:1)?1:0.15}}>⭐</div>)}
          </div>
          <div style={{display:'flex',gap:10,marginBottom:12}}>
            <div className="sim-card" style={{flex:1,textAlign:'center',background:pass?'#F0FDF4':'#FEF2F2',borderColor:pass?'#BBF7D0':'#FECACA'}}>
              <div style={{fontSize:36,fontWeight:900,color:pass?C.green:'#991B1B'}}>{avgScore}%</div>
              <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',marginTop:2}}>Avg Score</div>
            </div>
            <div className="sim-card" style={{flex:1,textAlign:'center'}}>
              <div style={{fontSize:36,fontWeight:900,color:C.gold}}>+{Math.round(vTotal*0.4)}</div>
              <div style={{fontSize:11,color:C.muted,textTransform:'uppercase',marginTop:2}}>XP Earned</div>
            </div>
          </div>
          <div className="sim-card" style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Examiner's Remark</div>
            <div style={{fontSize:13,color:C.text,lineHeight:1.6,fontStyle:'italic'}}>
              {avgScore>=80?'Excellent viva performance. Student demonstrates strong clinical reasoning and deep procedural knowledge. Highly recommended.':avgScore>=60?'Good performance. Student shows adequate understanding but should strengthen clinical rationale and documentation answers.':'Performance below standard. Student needs to review clinical theory and practice explaining procedures clearly.'}
            </div>
            <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:8,fontSize:11,color:C.muted,display:'flex',justifyContent:'space-between'}}>
              <span>Signature: _______________</span>
              <span>{new Date().toLocaleDateString('en-NG')}</span>
            </div>
          </div>
          <div className="sim-card" style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Question Breakdown</div>
            {vHistory.map((h:any,i:number) => (
              <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                <div style={{width:36,height:36,borderRadius:10,flexShrink:0,background:h.score>=70?'#F0FDF4':h.score>=50?'#FFFBEB':'#FEF2F2',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:900,color:h.score>=70?C.green:h.score>=50?'#92400E':'#991B1B'}}>{h.score}</div>
                <div style={{fontSize:12,color:C.muted,flex:1,lineHeight:1.3}}>{h.q.substring(0,65)}...</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button className="sim-btn-navy" style={{flex:1}} onClick={() => generateViva(proc)}>🔄 New Viva</button>
            <button className="sim-btn-outline" style={{flex:1}} onClick={() => setScreen('modes')}>Change Mode</button>
          </div>
          <button onClick={() => setScreen('home')} style={{background:'none',border:'none',color:C.muted,fontSize:13,cursor:'pointer',width:'100%',marginTop:10,fontFamily:'inherit'}}>← Home</button>
        </div>
      </div>
    )
  }

  return null
}
